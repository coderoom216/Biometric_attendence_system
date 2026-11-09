import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/system/audit-logs
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
