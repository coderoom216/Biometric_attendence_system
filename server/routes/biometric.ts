import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { BiometricPunchLog } from '../types';

const router = Router();
const biometricRoles = [
  'caretaker_operator',
  'residential_warden',
  'warden',
  'chief_warden',
  'director'
] as const;

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
        store.recordDefaulter(student.id, store.virtualDate, punchClassification.remarks);
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

// GET /api/biometric/enrolled-users
// Reads device user IDs and fetched user information from SDK MongoDB.
router.get(
  '/enrolled-users',
  authenticate,
  requireRole([...biometricRoles]),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { getBiometricNamedCollection } = await import('../services/biometricMongo');

      const userIdCollection = await getBiometricNamedCollection('get_user_id');
      const userInfoCollection = await getBiometricNamedCollection('user_info_result');

      const [userRecords, infoRecords] = await Promise.all([
        userIdCollection.find({}).toArray(),
        userInfoCollection.find({}).sort({ created_at: -1 }).toArray()
      ]);

      const infoByKey = new Map<string, any>();

      for (const record of infoRecords as any[]) {
        const key = `${String(record.dev_id ?? '')}|${String(record.user_id ?? '')}`;

        if (!infoByKey.has(key)) {
          let info: any = null;

          try {
            info = typeof record.info === 'string'
              ? JSON.parse(record.info)
              : record.info ?? null;
          } catch {
            info = null;
          }

          infoByKey.set(key, {
            info,
            fetchedAt: record.created_at ?? null
          });
        }
      }

      const uniqueUsers = new Map<string, any>();

      for (const record of userRecords as any[]) {
        const userId = String(record.user_id ?? '').trim();
        const deviceSerial = String(record.dev_id ?? '').trim();

        if (!userId || !deviceSerial) continue;

        const key = `${deviceSerial}|${userId}`;

        if (uniqueUsers.has(key)) continue;

        const fetched = infoByKey.get(key);
        const info = fetched?.info;

        const enrollments = Array.isArray(info?.enroll_data_array)
          ? info.enroll_data_array
          : [];

        const fingerprintSlots = enrollments.filter((item: any) => {
          const slot = Number(item?.backup_number);
          return Number.isInteger(slot) && slot >= 0 && slot <= 9 &&
            Boolean(item?.enroll_data);
        });

        uniqueUsers.set(key, {
          userId,
          deviceSerial,
          name: info?.user_name ?? null,
          privilege: info?.user_privilege ?? null,
          enabled: info?.user_enabled ?? null,
          hasInfo: Boolean(info),
          infoFetchedAt: fetched?.fetchedAt ?? null,
          fingerprintEnrolled: fingerprintSlots.length > 0,
          fingerprintCount: fingerprintSlots.length
        });
      }

      const users = Array.from(uniqueUsers.values()).sort((a, b) =>
        a.userId.localeCompare(b.userId)
      );

      return res.json({
        success: true,
        total: users.length,
        users
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: error instanceof Error
          ? error.message
          : 'Unable to read enrolled biometric users'
      });
    }
  }
);


// GET /api/biometric/live
// Reads actual SDK punch records from MongoDB.
router.get(
  '/live',
  authenticate,
  requireRole([...biometricRoles]),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        getBiometricCollection,
        getBiometricMongoStatus
      } = await import('../services/biometricMongo');

      const collection = await getBiometricCollection();
      const records = await collection
        .find({})
        .sort({ id: -1 })
        .limit(100)
        .toArray();

      const status = await getBiometricMongoStatus();

      const studentsByBiometricId = new Map(
        store.students.map((student) => [
          String(student.biometricId),
          student
        ])
      );

      const punches = records.map((record: any) => {
        const biometricId = String(record.user_id ?? '');
        const student = studentsByBiometricId.get(biometricId);

        return {
          id: record.id?.toString?.() ??
            String(record.id ?? record._id),
          biometricId,
          studentName: student?.name ?? null,
          enrollmentNo: student?.enrollmentNo ?? null,
          hostelId: student?.hostelId ?? null,
          deviceSerial: record.dev_id ?? null,
          verifyMode: record.verify_mode ?? null,
          ioMode: record.io_mode ?? null,
          direction:
            record.io_mode === 1 || record.io_mode === '1'
              ? 'IN'
              : record.io_mode === 0 || record.io_mode === '0'
                ? 'OUT'
                : 'UNKNOWN',
          punchTime: record.io_time ?? null,
          recognized: Boolean(student)
        };
      });

      return res.json({
        success: true,
        mongo: status,
        total: punches.length,
        punches
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: error instanceof Error
          ? error.message
          : 'Unable to read biometric MongoDB collection'
      });
    }
  }
);


export default router;



