import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { BiometricPunchLog } from '../types';

const router = Router();

// GET /api/biometric/devices
router.get(
  '/devices',
  authenticate,
  requireRole(['caretaker_operator', 'residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    return res.json({
      success: true,
      authorizedAdministrator: 'Mr. Vivek Mehra (Computer Science Dept)',
      devices: store.biometricDevices
    });
  }
);

// POST /api/biometric/sync (Authorized import script under Mr. Mehra's access - FR-01)
router.post(
  '/sync',
  authenticate,
  requireRole(['caretaker_operator', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { deviceId, punches } = req.body; // punches: Array of { biometricId, punchTimestamp }

    const device = store.biometricDevices.find((d) => d.id === deviceId || d.deviceId === deviceId);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Biometric terminal device not registered' });
    }

    if (!Array.isArray(punches) || punches.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid payload: Array of biometric punches required' });
    }

    let processedCount = 0;
    let duplicateCount = 0;
    let unrecognizedCount = 0;

    for (const punch of punches) {
      const student = store.students.find((s) => s.biometricId === punch.biometricId);

      if (!student) {
        unrecognizedCount++;
        store.biometricLogs.push({
          id: `blog-${Date.now()}-${Math.random()}`,
          biometricId: punch.biometricId,
          deviceId: device.deviceId,
          punchTimestamp: punch.punchTimestamp,
          importedAt: `${store.virtualDate} ${store.virtualTime} IST`,
          importedBy: `${user.name} (${user.role})`,
          status: 'unrecognized_id'
        });
        continue;
      }

      // Check if punch already exists for student today
      const existingToday = store.attendance.find(
        (a) => a.studentId === student.id && a.date === store.virtualDate && a.punchTime
      );

      if (existingToday) {
        duplicateCount++;
        store.biometricLogs.push({
          id: `blog-${Date.now()}-${Math.random()}`,
          biometricId: punch.biometricId,
          deviceId: device.deviceId,
          punchTimestamp: punch.punchTimestamp,
          importedAt: `${store.virtualDate} ${store.virtualTime} IST`,
          importedBy: `${user.name} (${user.role})`,
          status: 'duplicate_ignored'
        });
        continue;
      }

      // Process new punch based on standard 7:00 PM cutoff & 9:00 PM grace window
      const [hh, mm, ss = 0] = (punch.punchTime || '18:15').split(':').map(Number);
      const totalSeconds = hh * 3600 + (mm || 0) * 60 + ss;
      const cutoffSeconds = 19 * 60 * 60; // 7:00 PM
      const graceEndSeconds = 21 * 60 * 60; // 9:00 PM

      let punchStatus: 'present' | 'late' | 'absent' = 'present';
      let isDefaulter = false;
      let punchRemarks = 'On-time biometric check-in prior to 7:00 PM cut-off.';

      if (totalSeconds <= cutoffSeconds) {
        punchStatus = 'present';
        isDefaulter = false;
        punchRemarks = 'On-time biometric check-in prior to 7:00 PM cut-off.';
      } else if (totalSeconds <= graceEndSeconds) {
        punchStatus = 'late';
        isDefaulter = false;
        punchRemarks = 'Late punch within grace window (7:00 PM - 9:00 PM IST). Recorded late entry.';
      } else {
        punchStatus = 'absent';
        isDefaulter = true;
        punchRemarks = 'Punch attempted after 9:00 PM grace cutoff. Automatically categorized as Defaulter.';
      }

      let att = store.attendance.find(
        (a) => a.studentId === student.id && a.date === store.virtualDate
      );

      if (!att) {
        att = {
          id: `att-${student.id}-${store.virtualDate}`,
          studentId: student.id,
          enrollmentNo: student.enrollmentNo,
          studentName: student.name,
          hostelId: student.hostelId,
          block: student.block,
          roomNumber: student.roomNumber,
          date: store.virtualDate,
          status: punchStatus,
          punchTime: punch.punchTime || `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`,
          biometricDeviceId: device.id,
          isDefaulter,
          remarks: punchRemarks,
          evaluatedAt: `${store.virtualDate} ${store.virtualTime} IST`
        };
        store.attendance.push(att);
      } else if (att.status !== 'approved_leave') {
        att.status = punchStatus;
        att.punchTime = punch.punchTime || `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
        att.biometricDeviceId = device.id;
        att.isDefaulter = isDefaulter;
        att.remarks = punchRemarks;
      }

      if (isDefaulter && att.status !== 'approved_leave') {
        store.triggerSequentialNotifications(student, store.virtualDate);
      }

      processedCount++;
      store.biometricLogs.push({
        id: `blog-${Date.now()}-${Math.random()}`,
        biometricId: punch.biometricId,
        deviceId: device.deviceId,
        punchTimestamp: punch.punchTimestamp || `${store.virtualDate} ${store.virtualTime}`,
        importedAt: `${store.virtualDate} ${store.virtualTime} IST`,
        importedBy: `${user.name} (${user.role})`,
        status: 'processed'
      });
    }

    // Update device sync timestamp
    device.lastSyncAt = `${store.virtualDate} ${store.virtualTime} IST`;
    device.status = 'online_synced';

    store.logAudit(
      'BIOMETRIC_SYNC_EXECUTED',
      user,
      'BiometricDevice',
      device.deviceId,
      `Synchronized ${punches.length} punches. Processed: ${processedCount}, Duplicates: ${duplicateCount}, Unrecognized: ${unrecognizedCount}`
    );

    return res.json({
      success: true,
      message: `Biometric synchronization completed for terminal ${device.name}`,
      deviceId: device.deviceId,
      processedCount,
      duplicateCount,
      unrecognizedCount,
      lastSyncAt: device.lastSyncAt
    });
  }
);

// GET /api/biometric/health (Failure handling & stale logs detection - FR-12)
router.get(
  '/health',
  authenticate,
  requireRole(['caretaker_operator', 'residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const devices = store.biometricDevices;
    const staleDevices = devices.filter((d) => d.status === 'stale_pending_import');
    const missingParentEmails = store.students.filter(
      (s) => s.verificationStatus === 'verified' && !s.parentEmail
    );
    const notificationFailures = store.notifications.filter((n) => n.status === 'failed');

    return res.json({
      success: true,
      systemHealth: staleDevices.length === 0 && notificationFailures.length === 0 ? 'Optimal' : 'Attention Required',
      totalDevices: devices.length,
      syncedDevices: devices.filter((d) => d.status === 'online_synced').length,
      staleDevicesCount: staleDevices.length,
      staleDevices: staleDevices.map((d) => ({
        id: d.id,
        name: d.name,
        lastSync: d.lastSyncAt,
        location: d.location
      })),
      missingParentEmailsCount: missingParentEmails.length,
      missingParentEmails: missingParentEmails.map((s) => ({
        id: s.id,
        name: s.name,
        enrollmentNo: s.enrollmentNo,
        hostel: s.hostelId,
        room: s.roomNumber
      })),
      notificationFailuresCount: notificationFailures.length,
      notificationFailures
    });
  }
);

export default router;
