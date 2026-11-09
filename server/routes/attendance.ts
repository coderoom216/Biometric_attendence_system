import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, requireHostelScope, AuthenticatedRequest } from '../middleware/auth';
import { AttendanceRecord, AttendanceStatus } from '../types';

const router = Router();

// GET /api/attendance/today
router.get('/today', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const targetDate = store.virtualDate;

  let records = store.attendance.filter((a) => a.date === targetDate);

  // Student scope isolation
  if (user.role === 'student') {
    records = records.filter((a) => a.studentId === user.studentId);
  }
  // Warden & Residential Warden hostel scope isolation
  else if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
    records = records.filter((a) => a.hostelId === user.hostelId);
  }

  // Summary stats
  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const late = records.filter((r) => r.status === 'late').length;
  const approvedLeave = records.filter((r) => r.status === 'approved_leave').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const defaulters = records.filter((r) => r.isDefaulter).length;

  return res.json({
    success: true,
    date: targetDate,
    virtualTime: store.virtualTime,
    isPastCutoff: store.isPastCutoff(),
    isPastDefaulterTime: store.isPastDefaulterTime(),
    stats: {
      total,
      present,
      late,
      approvedLeave,
      absent,
      defaulters
    },
    records
  });
});

// GET /api/attendance/defaulters (9:00 PM IST post-grace defaulters list)
router.get(
  '/defaulters',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director', 'caretaker_operator']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const targetDate = req.query.date ? String(req.query.date) : store.virtualDate;

    let defaulters = store.attendance.filter(
      (a) => a.date === targetDate && (a.isDefaulter || a.status === 'absent')
    );

    // Warden scoping
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
      defaulters = defaulters.filter((a) => a.hostelId === user.hostelId);
    } else if (req.query.hostelId && req.query.hostelId !== 'all') {
      defaulters = defaulters.filter((a) => a.hostelId === String(req.query.hostelId));
    }

    return res.json({
      success: true,
      targetDate,
      virtualTime: store.virtualTime,
      isDefaulterListVisible: store.isPastDefaulterTime(),
      count: defaulters.length,
      defaulters
    });
  }
);

// GET /api/attendance/late-punches (Grace window 7:00 PM - 9:00 PM late entries list)
router.get(
  '/late-punches',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director', 'caretaker_operator']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const targetDate = req.query.date ? String(req.query.date) : store.virtualDate;

    let latePunches = store.attendance.filter(
      (a) => a.date === targetDate && a.status === 'late'
    );

    // Warden scoping
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
      latePunches = latePunches.filter((a) => a.hostelId === user.hostelId);
    } else if (req.query.hostelId && req.query.hostelId !== 'all') {
      latePunches = latePunches.filter((a) => a.hostelId === String(req.query.hostelId));
    }

    return res.json({
      success: true,
      targetDate,
      virtualTime: store.virtualTime,
      count: latePunches.length,
      latePunches
    });
  }
);

// GET /api/attendance/history
router.get('/history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { startDate, endDate, hostelId, block, status, search } = req.query;

  let records = [...store.attendance];

  // Student scope isolation: Students can strictly ONLY see their own history
  if (user.role === 'student') {
    records = records.filter((a) => a.studentId === user.studentId);
  }
  // Warden hostel scope isolation
  else if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
    records = records.filter((a) => a.hostelId === user.hostelId);
  } else if (hostelId) {
    records = records.filter((a) => a.hostelId === String(hostelId));
  }

  if (startDate) {
    records = records.filter((a) => a.date >= String(startDate));
  }
  if (endDate) {
    records = records.filter((a) => a.date <= String(endDate));
  }
  if (block) {
    records = records.filter((a) => a.block === String(block));
  }
  if (status) {
    records = records.filter((a) => a.status === String(status));
  }
  if (search) {
    const q = String(search).toLowerCase();
    records = records.filter(
      (a) =>
        a.studentName.toLowerCase().includes(q) ||
        a.enrollmentNo.toLowerCase().includes(q) ||
        a.roomNumber.toLowerCase().includes(q)
    );
  }

  // Sort by date desc
  records.sort((a, b) => b.date.localeCompare(a.date));

  return res.json({
    success: true,
    totalRecords: records.length,
    records
  });
});

// POST /api/attendance/correct (Authorized correction by Residential Warden/Warden)
router.post(
  '/correct',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { recordId, newStatus, reason } = req.body;

    if (!recordId || !newStatus || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Record ID, newStatus (present, late, approved_leave, absent), and justification reason are required'
      });
    }

    const record = store.attendance.find((a) => a.id === recordId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    // Warden scope check
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId && record.hostelId !== user.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: You can only correct records for your assigned hostel'
      });
    }

    const oldStatus = record.status;
    record.status = newStatus as AttendanceStatus;
    record.isDefaulter = newStatus === 'absent';
    record.correctedBy = `${user.name} (${user.role})`;
    record.correctedAt = `${store.virtualDate} ${store.virtualTime} IST`;
    record.correctionReason = reason;

    store.logAudit(
      'ATTENDANCE_CORRECTION',
      user,
      'AttendanceRecord',
      record.id,
      `Changed status for ${record.studentName} (${record.enrollmentNo}) from ${oldStatus} to ${newStatus}. Reason: ${reason}`
    );

    return res.json({
      success: true,
      message: 'Attendance record updated successfully with formal audit trail',
      record
    });
  }
);

// POST /api/attendance/record-punch (Simulate a biometric punch)
router.post(
  '/record-punch',
  authenticate,
  requireRole(['caretaker_operator', 'residential_warden', 'warden']),
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId, punchTime } = req.body;
    const student = store.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const time = punchTime || store.virtualTime;
    const [hh, mm, ss = 0] = time.split(':').map(Number);
    const punchSeconds = hh * 3600 + mm * 60 + ss;
    const cutoffSeconds = 19 * 3600;
    const graceEndSeconds = 21 * 3600;
    const status = punchSeconds <= cutoffSeconds ? 'present' : punchSeconds <= graceEndSeconds ? 'late' : 'absent';
    const isDefaulter = status === 'absent';

    let record = store.attendance.find(
      (a) => a.studentId === student.id && a.date === store.virtualDate
    );

    if (!record) {
      record = {
        id: `att-${student.id}-${store.virtualDate}`,
        studentId: student.id,
        enrollmentNo: student.enrollmentNo,
        studentName: student.name,
        hostelId: student.hostelId,
        block: student.block,
        roomNumber: student.roomNumber,
        date: store.virtualDate,
        status,
        punchTime: time,
        biometricDeviceId: 'bdev-shiv-01',
        isDefaulter,
        evaluatedAt: `${store.virtualDate} ${store.virtualTime} IST`
      };
      store.attendance.push(record);
    } else {
      record.status = status;
      record.punchTime = time;
      record.isDefaulter = isDefaulter;
    }

    if (isDefaulter) store.triggerSequentialNotifications(student, store.virtualDate);

    return res.json({
      success: true,
      message: `Punch recorded at ${time} IST (${record.status})`,
      record
    });
  }
);

export default router;
