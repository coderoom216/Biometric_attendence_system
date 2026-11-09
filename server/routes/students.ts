import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, requireStudentOwnership, AuthenticatedRequest } from '../middleware/auth';
import { Student } from '../types';

const router = Router();

// GET /api/students (scoped)
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let list = [...store.students];

  // Student scope isolation
  if (user.role === 'student') {
    list = list.filter((s) => s.id === user.studentId);
  }
  // Warden hostel scoping
  else if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
    list = list.filter((s) => s.hostelId === user.hostelId);
  }

  return res.json({
    success: true,
    total: list.length,
    students: list
  });
});

// GET /api/students/warning-tickets (Automated Notification & Warning Strike Records)
router.get(
  '/warning-tickets',
  authenticate,
  requireRole(['caretaker_operator', 'residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    let tickets = store.getWarningTickets();

    // Warden hostel scoping
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
      tickets = tickets.filter((t) => t.hostelId === user.hostelId);
    } else if (req.query.hostelId && req.query.hostelId !== 'all') {
      tickets = tickets.filter((t) => t.hostelId === req.query.hostelId);
    }

    return res.json({
      success: true,
      total: tickets.length,
      tickets
    });
  }
);

// PATCH /api/students/warning-tickets/:id (Review / Resolve warning ticket)
router.patch(
  '/warning-tickets/:id',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const ticket = store.warningTickets.find((t) => t.id === id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Warning ticket not found' });
    }

    // Role scoping for warden
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId && ticket.hostelId !== user.hostelId) {
      return res.status(403).json({ success: false, message: 'Access denied: Ticket belongs to another hostel' });
    }

    if (status) ticket.status = status;
    if (adminNotes !== undefined) ticket.adminNotes = adminNotes;

    store.logAudit(
      'WARNING_TICKET_UPDATED',
      user,
      'WarningTicket',
      ticket.id,
      `Updated warning ticket for ${ticket.studentName} (${ticket.enrollmentNo}): Status=${ticket.status}, Notes=${ticket.adminNotes || 'none'}`
    );

    return res.json({
      success: true,
      message: 'Warning ticket updated successfully',
      ticket
    });
  }
);

// GET /api/students/export-directory-excel (Export Master Student Directory to Excel format)
router.get(
  '/export-directory-excel',
  authenticate,
  requireRole(['caretaker_operator', 'residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    let students = [...store.students];

    // Warden hostel scoping
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
      students = students.filter((s) => s.hostelId === user.hostelId);
    } else if (req.query.hostelId && req.query.hostelId !== 'all') {
      students = students.filter((s) => s.hostelId === req.query.hostelId);
    }

    // Build tickets lookup
    const tickets = store.getWarningTickets();
    const ticketMap = new Map<string, typeof tickets[0]>();
    tickets.forEach((t) => ticketMap.set(t.studentId, t));

    // Map today's attendance records
    const attendanceMap = new Map<string, typeof store.attendance[0]>();
    store.attendance
      .filter((a) => a.date === store.virtualDate)
      .forEach((a) => attendanceMap.set(a.studentId, a));

    // Map hostel names
    const hostelMap = new Map<string, string>();
    store.hostels.forEach((h) => hostelMap.set(h.id, h.name));

    // Generate Excel CSV with UTF-8 BOM
    const headers = [
      'Room Number',
      'Student Name',
      'Roll Number (Enrollment)',
      'Hostel Name',
      'Block',
      'Bed Number',
      'Branch / Course',
      'Semester',
      'Biometric ID',
      'Parent Name',
      'Parent Phone Number',
      'Parent Email',
      'Student Phone',
      'Student Email',
      'Current Attendance Standing (Today)',
      'Biometric Punch Time',
      'Disciplinary Warning Level',
      'Late Punches Count',
      'Missed Check-ins Count',
      'Disciplinary Ticket Status',
      'Verification Status'
    ];

    const rows = students.map((s) => {
      const ticket = ticketMap.get(s.id);
      const att = attendanceMap.get(s.id);
      const hostelName = hostelMap.get(s.hostelId) || s.hostelId;
      const severityLabel = ticket
        ? ticket.severity === 'flagged_for_admin_review'
          ? 'CRITICAL - Admin Review'
          : ticket.severity === 'strike_2'
          ? 'Strike 2 (Final Notice)'
          : 'Strike 1 (Notice)'
        : 'Good Standing';

      const attStatusLabel = att
        ? att.status === 'present'
          ? 'Present (On-time)'
          : att.status === 'late'
          ? 'Late Grace Punch'
          : att.status === 'approved_leave'
          ? 'Approved Leave'
          : 'Defaulter (No punch by 9:00 PM)'
        : 'Pending Evaluation';

      return [
        `"${s.roomNumber || ''}"`,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${s.enrollmentNo || ''}"`,
        `"${hostelName}"`,
        `"${s.block || ''}"`,
        `"${s.bedNumber || 'A'}"`,
        `"${(s.course || '').replace(/"/g, '""')}"`,
        `"Semester ${s.semester || 1}"`,
        `"${s.biometricId || ''}"`,
        `"${(s.parentName || '').replace(/"/g, '""')}"`,
        `"${s.parentPhone || ''}"`,
        `"${s.parentEmail || ''}"`,
        `"${s.studentPhone || ''}"`,
        `"${s.studentEmail || ''}"`,
        `"${attStatusLabel}"`,
        `"${att?.punchTime || '—'}"`,
        `"${severityLabel}"`,
        `"${ticket ? ticket.latePunchesCount : 0}"`,
        `"${ticket ? ticket.missedCheckInsCount : 0}"`,
        `"${ticket ? ticket.status : 'Clean Record'}"`,
        `"${s.verificationStatus || 'verified'}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const filename = `Student_Directory_${store.virtualDate}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  }
);

// GET /api/students/:studentId (Protected by IDOR ownership check)
router.get('/:studentId', authenticate, requireStudentOwnership('studentId'), (req: AuthenticatedRequest, res: Response) => {
  const { studentId } = req.params;
  const student = store.students.find((s) => s.id === studentId);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student profile not found' });
  }

  // Double check warden scope
  const user = req.user!;
  if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId && student.hostelId !== user.hostelId) {
    return res.status(403).json({
      success: false,
      message: 'Security Violation: Cannot access student belonging to another hostel'
    });
  }

  return res.json({
    success: true,
    student
  });
});

// POST /api/students/onboard (Caretakers/Officials input verified profile details - FR-02)
router.post(
  '/onboard',
  authenticate,
  requireRole(['caretaker_operator', 'residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const {
      enrollmentNo,
      name,
      course,
      semester,
      gender,
      hostelId,
      block,
      roomNumber,
      bedNumber,
      biometricId,
      studentEmail,
      studentPhone,
      parentName,
      parentEmail,
      parentPhone
    } = req.body;

    if (!enrollmentNo || !name || !hostelId || !block || !roomNumber || !biometricId || !studentEmail) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment No, Name, Hostel, Block, Room, Biometric ID, and Student Email are required'
      });
    }

    // Check duplicate enrollment number
    if (store.students.some((s) => s.enrollmentNo.toLowerCase() === enrollmentNo.toLowerCase())) {
      return res.status(409).json({
        success: false,
        message: `Student with enrollment number ${enrollmentNo} is already registered.`
      });
    }

    const newStudent: Student = {
      id: `stu-${Date.now()}`,
      enrollmentNo: enrollmentNo.trim().toUpperCase(),
      name: name.trim(),
      course: course || 'B.Tech CSE',
      semester: Number(semester) || 1,
      gender: gender || 'male',
      hostelId,
      block,
      roomNumber,
      bedNumber: bedNumber || 'A',
      biometricId: biometricId.trim(),
      studentEmail: studentEmail.trim().toLowerCase(),
      studentPhone: studentPhone || '',
      parentName: parentName || '',
      parentEmail: parentEmail ? parentEmail.trim().toLowerCase() : '',
      parentPhone: parentPhone || '',
      verificationStatus: 'verified',
      verifiedBy: `${user.name} (${user.role})`,
      verifiedAt: `${store.virtualDate} ${store.virtualTime} IST`,
      allotmentDate: store.virtualDate,
      checkoutStatus: 'active'
    };

    store.students.push(newStudent);

    // Also update room occupancy
    const room = store.rooms.find((r) => r.hostelId === hostelId && r.block === block && r.roomNumber === roomNumber);
    if (room) {
      room.currentOccupancy = Math.min(room.capacity, room.currentOccupancy + 1);
      if (room.currentOccupancy >= room.capacity) {
        room.status = 'full';
      }
    }

    store.logAudit(
      'STUDENT_ONBOARDED',
      user,
      'Student',
      newStudent.id,
      `Onboarded verified student: ${newStudent.name} (${newStudent.enrollmentNo}), Room ${newStudent.roomNumber}, Biometric ${newStudent.biometricId}`
    );

    return res.status(201).json({
      success: true,
      message: 'Student record onboarded and verified successfully',
      student: newStudent
    });
  }
);

// POST /api/students/verify (Warden formal verification of student registration request)
router.post(
  '/verify',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { studentId, action, rejectionReason } = req.body; // action: 'approve' | 'reject'

    const student = store.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student registration record not found' });
    }

    if (action === 'approve') {
      student.verificationStatus = 'verified';
      student.verifiedBy = `${user.name} (${user.role})`;
      student.verifiedAt = `${store.virtualDate} ${store.virtualTime} IST`;
      student.rejectionReason = undefined;

      store.logAudit(
        'STUDENT_REGISTRATION_VERIFIED',
        user,
        'Student',
        student.id,
        `Formally verified student registration for ${student.name} (${student.enrollmentNo})`
      );

      return res.json({
        success: true,
        message: `Student ${student.name} registration verified and activated`,
        student
      });
    } else {
      student.verificationStatus = 'rejected';
      student.rejectionReason = rejectionReason || 'Information does not match official admission list';
      student.verifiedBy = `${user.name} (${user.role})`;
      student.verifiedAt = `${store.virtualDate} ${store.virtualTime} IST`;

      store.logAudit(
        'STUDENT_REGISTRATION_REJECTED',
        user,
        'Student',
        student.id,
        `Rejected student registration for ${student.name} (${student.enrollmentNo}). Reason: ${student.rejectionReason}`
      );

      return res.json({
        success: true,
        message: `Student registration rejected. Reason recorded in audit log.`,
        student
      });
    }
  }
);

// POST /api/students/submit-registration (Student submits registration form for review)
router.post('/submit-registration', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { enrollmentNo, name, course, hostelId, block, roomNumber, biometricId, parentName, parentEmail, parentPhone } = req.body;

  const existing = store.students.find((s) => s.enrollmentNo.toLowerCase() === (enrollmentNo || '').toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: 'Enrollment number is already linked to a record' });
  }

  const newSubmission: Student = {
    id: `stu-${Date.now()}`,
    enrollmentNo: enrollmentNo.trim().toUpperCase(),
    name: name || user.name,
    course: course || 'B.Tech CSE',
    semester: 1,
    gender: 'male',
    hostelId: hostelId || 'h-shivalik',
    block: block || 'Block A',
    roomNumber: roomNumber || '101',
    biometricId: biometricId || `BIO-${Date.now().toString().slice(-4)}`,
    studentEmail: user.email,
    studentPhone: user.phone || '',
    parentName: parentName || '',
    parentEmail: parentEmail || '',
    parentPhone: parentPhone || '',
    verificationStatus: 'pending_verification',
    allotmentDate: store.virtualDate,
    checkoutStatus: 'active'
  };

  store.students.push(newSubmission);
  user.studentId = newSubmission.id;

  store.logAudit(
    'REGISTRATION_FORM_SUBMITTED',
    user,
    'Student',
    newSubmission.id,
    `Student submitted registration request for formal Warden review.`
  );

  return res.json({
    success: true,
    message: 'Registration submitted. It is now awaiting formal verification by the Warden on their dashboard.',
    student: newSubmission
  });
});

export default router;
