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
    const devices = req.user?.role === 'caretaker_operator'
      ? store.biometricDevices.filter((device) => device.hostelId !== 'h-mandakini')
      : store.biometricDevices;
    return res.json({
      success: true,
      authorizedAdministrator: 'Mr. Vivek Mehra (Computer Science Dept)',
      devices
    });
  }
);

// PATCH /api/biometric/devices/:deviceId (Record installation details)
router.patch(
  '/devices/:deviceId',
  authenticate,
  requireRole(['caretaker_operator', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const device = store.biometricDevices.find((entry) => entry.id === req.params.deviceId || entry.deviceId === req.params.deviceId);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Biometric device not found' });
    }
    if (user.role === 'caretaker_operator' && device.hostelId === 'h-mandakini') {
      return res.status(403).json({ success: false, message: 'Access denied: Girls Hostel devices are unavailable to caretaker accounts.' });
    }

    const { name, model, serialNumber, location, installationDate, installedBy, installationNotes } = req.body;
    if (!name?.trim() || !model?.trim() || !serialNumber?.trim() || !location?.trim() || !installedBy?.trim() || !installationDate) {
      return res.status(400).json({ success: false, message: 'Device name, model, serial number, location, installation date, and installer name are required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(installationDate) || Number.isNaN(Date.parse(installationDate))) {
      return res.status(400).json({ success: false, message: 'Installation date must be a valid date.' });
    }

    device.name = name.trim();
    device.model = model.trim();
    device.serialNumber = serialNumber.trim();
    device.location = location.trim();
    device.installationDate = installationDate;
    device.installedBy = installedBy.trim();
    device.installationNotes = typeof installationNotes === 'string' ? installationNotes.trim() : '';

    store.logAudit(
      'BIOMETRIC_DEVICE_DETAILS_UPDATED',
      user,
      'BiometricDevice',
      device.id,
      `Recorded installation details for ${device.name} (${device.deviceId}), installed by ${device.installedBy} on ${device.installationDate}`
    );

    return res.json({ success: true, message: 'Device installation details saved.', device });
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

    if (user.role === 'caretaker_operator' && device.hostelId === 'h-mandakini') {
      return res.status(403).json({ success: false, message: 'Access denied: Girls Hostel biometric devices are unavailable to caretaker accounts.' });
    }

    if (!Array.isArray(punches) || punches.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid payload: Array of biometric punches required' });
    }

    const invalidPunch = punches.find(
      (punch) =>
        !punch ||
        typeof punch !== 'object' ||
        (punch.punchTime !== undefined &&
          (typeof punch.punchTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(punch.punchTime)))
    );
    if (invalidPunch) {
      return res.status(400).json({ success: false, message: 'Punch time must use HH:mm or HH:mm:ss format.' });
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

      const punchTime = punch.punchTime || '18:15';
      const punchClassification = store.classifyPunch(punchTime);

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
          status: punchClassification.status,
          punchTime,
          biometricDeviceId: device.id,
          isDefaulter: punchClassification.isDefaulter,
          remarks: punchClassification.remarks,
          evaluatedAt: `${store.virtualDate} ${store.virtualTime} IST`
        };
        store.attendance.push(att);
      } else if (att.status !== 'approved_leave') {
        att.status = punchClassification.status;
        att.punchTime = punchTime;
        att.biometricDeviceId = device.id;
        att.isDefaulter = punchClassification.isDefaulter;
        att.remarks = punchClassification.remarks;
      }

      if (punchClassification.isDefaulter && att.status !== 'approved_leave') {
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
    const isCaretaker = req.user?.role === 'caretaker_operator';
    const devices = isCaretaker
      ? store.biometricDevices.filter((device) => device.hostelId !== 'h-mandakini')
      : store.biometricDevices;
    const staleDevices = devices.filter((d) => d.status === 'stale_pending_import');
    const visibleStudents = isCaretaker
      ? store.students.filter((student) => student.hostelId !== 'h-mandakini')
      : store.students;
    const missingParentEmails = visibleStudents.filter(
      (s) => s.verificationStatus === 'verified' && !s.parentEmail
    );
    const notificationFailures = store.notifications.filter((notification) =>
      notification.status === 'failed' && (!isCaretaker || notification.hostelId !== 'h-mandakini')
    );

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
