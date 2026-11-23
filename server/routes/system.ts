import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Semester settings are visible to institutional leadership and editable by the Chief Warden.
router.get(
  '/semester-settings',
  authenticate,
  (_req: AuthenticatedRequest, res: Response) => res.json({ success: true, settings: store.getSemesterSettings() })
);

router.put(
  '/semester-settings',
  authenticate,
  requireRole(['chief_warden']),
  (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.body;
    const isValidDate = (value: unknown): value is string => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
      return res.status(400).json({ success: false, message: 'Enter a valid semester start date and an end date on or after it.' });
    }
    store.setSemesterSettings(startDate, endDate);
    store.logAudit('SEMESTER_SETTINGS_UPDATED', req.user!, 'SemesterSettings', `${startDate}:${endDate}`, `Set active semester from ${startDate} through ${endDate}.`);
    return res.json({ success: true, settings: store.getSemesterSettings(), message: 'Semester dates saved. Warning totals now use this date range.' });
  }
);

router.get(
  '/audit-logs',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director', 'caretaker_operator']),
  (req: AuthenticatedRequest, res: Response) => {
    return res.json({
      success: true,
      total: store.auditLogs.length,
      logs: store.auditLogs
    });
  }
);

// GET /api/system/overview
router.get(
  '/overview',
  authenticate,
  requireRole(['chief_warden', 'director', 'caretaker_operator', 'residential_warden', 'warden']),
  (req: AuthenticatedRequest, res: Response) => {
    const totalStudents = store.students.length;
    const activeResidents = store.students.filter(
      (s) => s.verificationStatus === 'verified' && s.checkoutStatus === 'active'
    ).length;
    const pendingVerifications = store.students.filter(
      (s) => s.verificationStatus === 'pending_verification'
    ).length;

    const todayAtt = store.attendance.filter((a) => a.date === store.virtualDate);
    const present = todayAtt.filter((a) => a.status === 'present').length;
    const late = todayAtt.filter((a) => a.status === 'late').length;
    const leave = todayAtt.filter((a) => a.status === 'approved_leave').length;
    const absent = todayAtt.filter((a) => a.status === 'absent').length;
    const defaulters = todayAtt.filter((a) => a.isDefaulter).length;

    return res.json({
      success: true,
      virtualDate: store.virtualDate,
      virtualTime: store.virtualTime,
      isPastCutoff: store.isPastCutoff(),
      isPastDefaulterTime: store.isPastDefaulterTime(),
      stats: {
        totalStudents,
        activeResidents,
        pendingVerifications,
        totalHostels: store.hostels.length,
        totalRooms: store.rooms.length,
        totalCapacity: store.hostels.reduce((sum, h) => sum + h.capacity, 0),
        todayPresent: present,
        todayLate: late,
        todayLeave: leave,
        todayAbsent: absent,
        todayDefaulters: defaulters
      }
    });
  }
);

export default router;
