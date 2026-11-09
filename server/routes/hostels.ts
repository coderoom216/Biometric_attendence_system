import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, requireHostelScope, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/hostels
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let hostels = [...store.hostels];

  // If warden, scope to assigned hostel
  if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
    hostels = hostels.filter((h) => h.id === user.hostelId);
  }

  // Calculate dynamic active occupancy
  const enrichedHostels = hostels.map((h) => {
    const activeResidents = store.students.filter(
      (s) => s.hostelId === h.id && s.checkoutStatus === 'active' && s.verificationStatus === 'verified'
    ).length;
    return {
      ...h,
      currentOccupancy: activeResidents,
      availableBeds: Math.max(0, h.capacity - activeResidents)
    };
  });

  return res.json({
    success: true,
    hostels: enrichedHostels
  });
});

// GET /api/hostels/:hostelId/rooms (FR-04)
router.get('/:hostelId/rooms', authenticate, requireHostelScope('hostelId'), (req: AuthenticatedRequest, res: Response) => {
  const { hostelId } = req.params;
  const rooms = store.rooms.filter((r) => r.hostelId === hostelId);

  // For each room, get assigned students
  const enrichedRooms = rooms.map((room) => {
    const occupants = store.students.filter(
      (s) => s.hostelId === hostelId && s.block === room.block && s.roomNumber === room.roomNumber && s.checkoutStatus === 'active'
    );
    return {
      ...room,
      occupants: occupants.map((o) => ({ id: o.id, name: o.name, enrollmentNo: o.enrollmentNo, bed: o.bedNumber })),
      currentOccupancy: occupants.length,
      isVacant: occupants.length === 0,
      availableBeds: Math.max(0, room.capacity - occupants.length)
    };
  });

  return res.json({
    success: true,
    hostelId,
    totalRooms: enrichedRooms.length,
    rooms: enrichedRooms
  });
});

// POST /api/hostels/allocate-room (FR-04)
router.post(
  '/allocate-room',
  authenticate,
  requireRole(['caretaker_operator', 'residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { studentId, hostelId, block, roomNumber, bedNumber } = req.body;

    const student = store.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Warden scope check
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId && hostelId !== user.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Cannot allocate rooms in unassigned hostel'
      });
    }

    const room = store.rooms.find(
      (r) => r.hostelId === hostelId && r.block === block && r.roomNumber === roomNumber
    );

    if (room && room.currentOccupancy >= room.capacity) {
      return res.status(400).json({
        success: false,
        message: `Allocation failed: Room ${roomNumber} in ${block} is at full capacity (${room.capacity}/${room.capacity}).`
      });
    }

    student.hostelId = hostelId;
    student.block = block;
    student.roomNumber = roomNumber;
    student.bedNumber = bedNumber || 'A';
    student.checkoutStatus = 'active';

    if (room) {
      room.currentOccupancy += 1;
      if (room.currentOccupancy >= room.capacity) room.status = 'full';
    }

    store.logAudit(
      'ROOM_ALLOCATION',
      user,
      'Student',
      student.id,
      `Allocated Room ${roomNumber} (${block}) in ${hostelId} to ${student.name} (${student.enrollmentNo})`
    );

    return res.json({
      success: true,
      message: `Room ${roomNumber} allocated successfully to ${student.name}`,
      student
    });
  }
);

// POST /api/hostels/checkout (Hostel Empty/Vacating - FR-04 & Future Roadmap)
router.post(
  '/checkout',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { studentId, clearanceNotes } = req.body;

    const student = store.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Warden scope check
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId && student.hostelId !== user.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Cannot vacate student belonging to another hostel'
      });
    }

    student.checkoutStatus = 'vacated';
    student.checkoutDate = `${store.virtualDate} ${store.virtualTime} IST`;

    // Free up room occupancy
    const room = store.rooms.find(
      (r) => r.hostelId === student.hostelId && r.block === student.block && r.roomNumber === student.roomNumber
    );
    if (room && room.currentOccupancy > 0) {
      room.currentOccupancy -= 1;
      room.status = 'available';
    }

    store.logAudit(
      'HOSTEL_CHECKOUT',
      user,
      'Student',
      student.id,
      `Formally vacated student ${student.name} (${student.enrollmentNo}) from Room ${student.roomNumber}. Notes: ${clearanceNotes || 'All dues cleared'}`
    );

    return res.json({
      success: true,
      message: `Hostel checkout completed for ${student.name}. Room vacated in records.`,
      student
    });
  }
);

export default router;
