import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { LeaveApplication, LeaveRecord } from '../types';

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

router.get('/holidays', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ success: true, holidays: [...store.holidays].sort((a, b) => a.startDate.localeCompare(b.startDate)) });
});

router.get('/applications', authenticate, requireRole(['student', 'residential_warden', 'warden']), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let applications = [...store.leaveApplications];
  if (user.role === 'student') {
    applications = applications.filter((application) => application.studentId === user.studentId);
  } else {
    if (!user.hostelId) return res.status(403).json({ success: false, message: 'Your warden account is not assigned to a hostel.' });
    applications = applications.filter((application) => application.hostelId === user.hostelId);
  }
  applications.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return res.json({ success: true, applications });
});

router.post('/applications', authenticate, requireRole(['student']), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { startDate, endDate, reason } = req.body;
  const isValidDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'Enter valid leave dates and a reason.' });
  }
  const student = store.students.find((item) => item.id === user.studentId && item.verificationStatus === 'verified' && item.checkoutStatus === 'active');
  if (!student) return res.status(404).json({ success: false, message: 'An active verified student profile is required to apply for leave.' });

  const application: LeaveApplication = {
    id: `leave-app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    studentId: student.id,
    enrollmentNo: student.enrollmentNo,
    studentName: student.name,
    hostelId: student.hostelId,
    block: student.block,
    roomNumber: student.roomNumber,
    startDate,
    endDate,
    reason: reason.trim(),
    status: 'pending',
    submittedAt: `${store.virtualDate} ${store.virtualTime} IST`
  };
  store.leaveApplications.unshift(application);
  try {
    store.persistLeaveApplications();
  } catch (error) {
    store.leaveApplications = store.leaveApplications.filter((item) => item.id !== application.id);
    console.error('Unable to save leave application:', error);
    return res.status(500).json({ success: false, message: 'Unable to save your leave application. Please try again.' });
  }
  store.logAudit('LEAVE_APPLICATION_SUBMITTED', user, 'LeaveApplication', application.id, `${student.name} (${student.enrollmentNo}) submitted leave for ${startDate} through ${endDate}. Routed to the Residential Warden for ${student.hostelId}.`);
  return res.status(201).json({ success: true, application, message: 'Leave application sent to your Residential Warden.' });
});

router.patch('/applications/:id', authenticate, requireRole(['residential_warden', 'warden']), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const application = store.leaveApplications.find((item) => item.id === req.params.id);
  if (!application) return res.status(404).json({ success: false, message: 'Leave application not found.' });
  if (!user.hostelId || application.hostelId !== user.hostelId) {
    return res.status(403).json({ success: false, message: 'You can review applications only for your assigned hostel.' });
  }
  if (application.status !== 'pending') return res.status(409).json({ success: false, message: 'This application has already been reviewed.' });

  const { decision, reviewNote } = req.body;
  if (decision !== 'approved' && decision !== 'denied') {
    return res.status(400).json({ success: false, message: 'Choose approve or deny for this application.' });
  }
  const student = decision === 'approved' ? store.students.find((item) => item.id === application.studentId) : undefined;
  if (decision === 'approved' && !student) return res.status(404).json({ success: false, message: 'Student profile is no longer available.' });

  application.status = decision;
  application.reviewedAt = `${store.virtualDate} ${store.virtualTime} IST`;
  application.reviewedBy = `${user.name} (${user.role === 'residential_warden' ? 'Residential Warden' : 'Warden'})`;
  if (typeof reviewNote === 'string' && reviewNote.trim()) application.reviewNote = reviewNote.trim();

  if (decision === 'approved') {
    const approvedStudent = student!;
    const leave: LeaveRecord = {
      id: `leave-${Date.now()}`,
      studentId: approvedStudent.id,
      enrollmentNo: approvedStudent.enrollmentNo,
      studentName: approvedStudent.name,
      hostelId: approvedStudent.hostelId,
      block: approvedStudent.block,
      roomNumber: approvedStudent.roomNumber,
      startDate: application.startDate,
      endDate: application.endDate,
      reason: application.reason,
      gatePassNo: `LA-${Date.now().toString().slice(-8)}`,
      parentConsentVerified: false,
      enteredByResidentialWardenId: user.id,
      residentialWardenName: `${user.name} (${user.role === 'residential_warden' ? 'Residential Warden' : 'Warden'})`,
      createdAt: `${store.virtualDate} ${store.virtualTime} IST`,
      notes: `Approved from student leave application ${application.id}.`
    };
    store.leaves.unshift(leave);
    application.approvedLeaveId = leave.id;
    application.approvedLeaveRecord = leave;

    if (!store.isHoliday(store.virtualDate) && store.virtualDate >= application.startDate && store.virtualDate <= application.endDate) {
      const attendance = store.attendance.find((record) => record.studentId === approvedStudent.id && record.date === store.virtualDate);
      if (attendance) {
        attendance.status = 'approved_leave';
        attendance.isDefaulter = false;
        attendance.remarks = 'Leave application approved by Residential Warden. Absence alerts suppressed.';
      } else {
        store.attendance.push({
          id: `att-${approvedStudent.id}-${store.virtualDate}`,
          studentId: approvedStudent.id,
          enrollmentNo: approvedStudent.enrollmentNo,
          studentName: approvedStudent.name,
          hostelId: approvedStudent.hostelId,
          block: approvedStudent.block,
          roomNumber: approvedStudent.roomNumber,
          date: store.virtualDate,
          status: 'approved_leave',
          isDefaulter: false,
          evaluatedAt: `${store.virtualDate} ${store.virtualTime} IST`,
          remarks: 'Leave application approved by Residential Warden. Absence alerts suppressed.'
        });
      }
    }
  }

  try {
    store.persistLeaveApplications();
  } catch (error) {
    console.error('Unable to save leave application review:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the review. Please try again.' });
  }

  store.logAudit('LEAVE_APPLICATION_REVIEWED', user, 'LeaveApplication', application.id, `${application.status} leave application for ${application.studentName} (${application.enrollmentNo}), ${application.startDate} through ${application.endDate}.${application.reviewNote ? ` Note: ${application.reviewNote}` : ''}`);
  return res.json({ success: true, application, message: decision === 'approved' ? 'Application approved and added to the approved leave register.' : 'Application denied.' });
});

router.post('/holidays', authenticate, requireRole(['chief_warden']), (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate, reason } = req.body;
  const isValidDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!isValidDate(startDate) || !isValidDate(endDate) || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'Valid start and end dates and a reason are required.' });
  }
  if (startDate > endDate) return res.status(400).json({ success: false, message: 'End date cannot be before start date.' });
  const currentDate = new Date(`${startDate}T00:00:00.000Z`);
  const finalDate = new Date(`${endDate}T00:00:00.000Z`);
  while (currentDate <= finalDate) {
    const current = currentDate.toISOString().slice(0, 10);
    if (store.isHoliday(current)) return res.status(409).json({ success: false, message: `A holiday is already registered on ${current}.` });
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  const holiday = store.applyHoliday(startDate, endDate, reason.trim());
  holiday.createdBy = req.user!.name;
  store.logAudit('HOLIDAY_MARKED', req.user!, 'InstitutionalHoliday', holiday.id, `Marked ${startDate} through ${endDate} as a holiday. Reason: ${holiday.reason}. Attendance is not required across all hostels.`);
  return res.status(201).json({ success: true, holiday, message: 'Holiday applied across all hostels.' });
});

router.delete('/holidays/:id', authenticate, requireRole(['chief_warden']), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const holiday = store.holidays.find((item) => item.id === id);
  if (!holiday) return res.status(404).json({ success: false, message: 'Holiday period not found.' });
  store.removeHoliday(id);
  store.logAudit('HOLIDAY_REMOVED', req.user!, 'InstitutionalHoliday', id, `Removed holiday period ${holiday.startDate} through ${holiday.endDate}. Reason: ${holiday.reason}.`);
  return res.json({ success: true, message: 'Holiday removed.' });
});

// POST /api/leaves/enter
// Directive: Only Residential Warden (or authorized admin) enters approved leave into system.
// Student requests use /applications and must be approved by their Residential Warden first.
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
