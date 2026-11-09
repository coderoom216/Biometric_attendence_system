import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/scheduler/status
router.get('/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    virtualDate: store.virtualDate,
    virtualTime: store.virtualTime,
    cutoffTime: store.cutoffTime + ' IST',
    graceEndTime: store.graceEndTime + ' IST',
    defaulterFlagTime: store.defaulterFlagTime + ' IST',
    isPastCutoff: store.isPastCutoff(),
    isWithinGraceWindow: store.isWithinGraceWindow(),
    isPastDefaulterTime: store.isPastDefaulterTime(),
    scheduledJobs: store.scheduledJobs
  });
});

// POST /api/scheduler/evaluate-cutoff (FR-06 execution)
router.post(
  '/evaluate-cutoff',
  authenticate,
  requireRole(['chief_warden', 'director', 'caretaker_operator', 'residential_warden', 'warden']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    let jobLog;
    try {
      jobLog = store.evaluateCutoff({
        id: user.id,
        name: user.name,
        role: user.role
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Defaulter evaluation is not available yet.' });
    }

    return res.json({
      success: true,
      message: 'Attendance cutoff & grace window evaluated successfully. Defaulters at 9:00 PM flagged and 6-tier alerts queued.',
      jobLog
    });
  }
);

// POST /api/scheduler/set-clock (Controllable test clock simulator)
router.post(
  '/set-clock',
  authenticate,
  requireRole(['director', 'chief_warden', 'residential_warden', 'warden', 'caretaker_operator']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { time, date } = req.body;

    if (!time) {
      return res.status(400).json({ success: false, message: 'Time string (HH:mm:ss) required' });
    }

    store.setVirtualTime(time, date);

    store.logAudit(
      'CLOCK_SIMULATION_UPDATED',
      user,
      'SystemClock',
      'IST',
      `Virtual test clock adjusted to ${store.virtualDate} ${store.virtualTime} IST`
    );

    return res.json({
      success: true,
      message: `System test clock set to ${store.virtualDate} ${store.virtualTime} IST`,
      virtualDate: store.virtualDate,
      virtualTime: store.virtualTime,
      isPastCutoff: store.isPastCutoff(),
      isPastDefaulterTime: store.isPastDefaulterTime()
    });
  }
);

export default router;
