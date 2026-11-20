import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/notifications/logs (FR-08, FR-12)
router.get(
  '/logs',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director', 'caretaker_operator']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { studentId, tier, status, date } = req.query;

    let logs = [...store.notifications];

    // Warden scoping
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
      logs = logs.filter((n) => n.hostelId === user.hostelId);
    }

    if (studentId) {
      logs = logs.filter((n) => n.studentId === String(studentId));
    }
    if (tier) {
      logs = logs.filter((n) => n.tier === Number(tier));
    }
    if (status) {
      logs = logs.filter((n) => n.status === String(status));
    }
    if (date) {
      logs = logs.filter((n) => n.date === String(date));
    }

    const total = logs.length;
    const delivered = logs.filter((n) => n.status === 'delivered').length;
    const queued = logs.filter((n) => n.status === 'queued').length;
    const failed = logs.filter((n) => n.status === 'failed').length;

    return res.json({
      success: true,
      stats: { total, delivered, queued, failed },
      hierarchy: [
        'Tier 1: Residential Warden',
        'Tier 2: Warden',
        'Tier 3: Chief Warden',
        'Tier 4: Director Sir',
        'Tier 5: Student Parents / Guardians',
        'Tier 6: The Student'
      ],
      logs
    });
  }
);

// POST /api/notifications/retry (FR-12 failure recovery)
router.post(
  '/retry',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { notificationId, overrideEmail } = req.body;

    const notif = store.notifications.find((n) => n.id === notificationId);
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification log entry not found' });
    }

    if (overrideEmail) {
      notif.recipientEmail = overrideEmail;
      // Also update student parent email if tier 5
      if (notif.tier === 5) {
        const student = store.students.find((s) => s.id === notif.studentId);
        if (student) {
          student.parentEmail = overrideEmail;
        }
      }
    }

    if (!notif.recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Cannot retry notification: Recipient email address is empty'
      });
    }

    notif.status = 'delivered';
    notif.failureReason = undefined;
    notif.retryCount += 1;
    notif.timestamp = `${store.virtualDate} ${store.virtualTime} IST (Retried)`;

    store.logAudit(
      'NOTIFICATION_RETRIED',
      user,
      'NotificationLog',
      notif.id,
      `Retried Tier ${notif.tier} alert for student ${notif.studentName} to ${notif.recipientEmail}. Status updated to delivered.`
    );

    return res.json({
      success: true,
      message: `Notification retried successfully to ${notif.recipientEmail}`,
      notification: notif
    });
  }
);

export default router;
