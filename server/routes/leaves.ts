import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { LeaveRecord } from '../types';

const router = Router();

// GET /api/leaves
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let list = [...store.leaves];

  // Student scope isolation: students can only see their own leave records
  if (user.role === 'student') {
    list = list.filter((l) => l.studentId === user.studentId);
  }
  // Warden & Residential Warden hostel scoping
  else if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
    list = list.filter((l) => l.hostelId === user.hostelId);
  }

  // Sort desc
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return res.json({
    success: true,
    total: list.length,
    leaves: list
  });
});

// POST /api/leaves/enter
// Directive: Only Residential Warden (or authorized admin) enters approved leave into system.
// Students CANNOT directly apply or approve leave on their own.
router.post(
  '/enter',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const {
      studentId,
      startDate,
      endDate,
      reason,
      gatePassNo,
      parentConsentVerified,
      notes
    } = req.body;

    if (!studentId || !startDate || !endDate || !reason || !gatePassNo) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, start date, end date, reason, and gate pass number are required'
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date'
      });
    }

    const student = store.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in institutional roster' });
    }

    // Warden scope check
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId && student.hostelId !== user.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: You can only enter leaves for students in your assigned hostel'
      });
    }

    const newLeave: LeaveRecord = {
      id: `leave-${Date.now()}`,
      studentId: student.id,
      enrollmentNo: student.enrollmentNo,
      studentName: student.name,
      hostelId: student.hostelId,
      block: student.block,
      roomNumber: student.roomNumber,
      startDate,
      endDate,
      reason,
      gatePassNo,
      parentConsentVerified: Boolean(parentConsentVerified),
      enteredByResidentialWardenId: user.id,
      residentialWardenName: `${user.name} (${user.role})`,
      createdAt: `${store.virtualDate} ${store.virtualTime} IST`,
      notes
    };

    store.leaves.unshift(newLeave);

    // If leave covers today, immediately update today's attendance record and suppress absence alert
    if (store.virtualDate >= startDate && store.virtualDate <= endDate) {
      const todayAtt = store.attendance.find(
        (a) => a.studentId === student.id && a.date === store.virtualDate
      );
      if (todayAtt) {
        todayAtt.status = 'approved_leave';
        todayAtt.isDefaulter = false;
        todayAtt.remarks = 'Approved leave verified by Residential Warden. Automated absence emails suppressed.';
      } else {
        store.attendance.push({
          id: `att-${student.id}-${store.virtualDate}`,
          studentId: student.id,
          enrollmentNo: student.enrollmentNo,
          studentName: student.name,
          hostelId: student.hostelId,
          block: student.block,
          roomNumber: student.roomNumber,
          date: store.virtualDate,
          status: 'approved_leave',
          isDefaulter: false,
          evaluatedAt: `${store.virtualDate} ${store.virtualTime} IST`,
          remarks: 'Approved leave verified by Residential Warden. Automated absence emails suppressed.'
        });
      }
    }

    store.logAudit(
      'LEAVE_ENTERED',
      user,
      'LeaveRecord',
      newLeave.id,
      `Entered approved leave for ${student.name} (${student.enrollmentNo}) from ${startDate} to ${endDate}. Reason: ${reason}. Gate Pass: ${gatePassNo}`
    );

    return res.json({
      success: true,
      message: 'Leave entered and approved successfully. Automated absence notifications suppressed for approved dates.',
      leave: newLeave
    });
  }
);

export default router;
