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


// POST /api/biometric/trigger-user-fetch
// Queues GET_USER_ID_LIST and missing GET_USER_INFO commands to pull latest enrollments from machine
router.post(
  '/trigger-user-fetch',
  authenticate,
  requireRole([...biometricRoles]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getBiometricNamedCollection } = await import('../services/biometricMongo');
      const pendingCollection = await getBiometricNamedCollection('command_request_pending');
      const userIdCollection = await getBiometricNamedCollection('get_user_id');
      const userInfoCollection = await getBiometricNamedCollection('user_info_result');

      const devId = (req.body?.deviceId as string) || 'RSS20241199684';

      // 1. Check if there is already an active command
      const activeCommand = await pendingCollection.findOne({
        dev_id: devId,
        trans_status: { $in: ['pending', 'running'] }
      });

      if (activeCommand) {
        return res.json({
          success: true,
          message: 'Device command already pending or in progress. Please wait a few seconds.',
          pending: true
        });
      }

      // 2. Queue GET_USER_ID_LIST
      const transId = String(Math.floor(10000 + Math.random() * 90000));
      const lastDoc = await pendingCollection.find({}).sort({ id: -1 }).limit(1).next();
      const nextId = (lastDoc && (lastDoc as any).id) ? Number((lastDoc as any).id) + 1 : 1;

      await pendingCollection.insertOne({
        trans_id: transId,
        dev_id: devId,
        cmd_code: 'GET_USER_ID_LIST',
        cmd_param: '',
        trans_status: 'pending',
        trans_status_update_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
        result: null,
        id: nextId
      });

      // 3. Queue GET_USER_INFO for user IDs that are missing info OR whose fingerprint is not yet confirmed
      const existingUsers = await userIdCollection.find({ dev_id: devId }).toArray();
      const existingInfos = await userInfoCollection.find({ dev_id: devId }).sort({ created_at: -1 }).toArray();

      const confirmedFingerprintUserIds = new Set<string>();
      for (const record of existingInfos as any[]) {
        const uid = String(record.user_id || '').trim();
        let info = record.info;
        if (typeof info === 'string') {
          try { info = JSON.parse(info); } catch { info = null; }
        }
        const enrollments = Array.isArray(info?.enroll_data_array) ? info.enroll_data_array : [];
        const hasFingerprint = enrollments.some((item: any) => {
          const slot = Number(item?.backup_number);
          return Number.isInteger(slot) && slot >= 0 && slot <= 9 && Boolean(item?.enroll_data);
        });
        if (hasFingerprint) {
          confirmedFingerprintUserIds.add(uid);
        }
      }

      let queuedInfoCount = 0;
      for (const u of existingUsers) {
        const uid = String((u as any).user_id || '').trim();
        if (uid && uid !== '0' && !confirmedFingerprintUserIds.has(uid)) {
          const infoTransId = String(Math.floor(10000 + Math.random() * 90000));
          await pendingCollection.insertOne({
            trans_id: infoTransId,
            dev_id: devId,
            cmd_code: 'GET_USER_INFO',
            cmd_param: JSON.stringify({ user_id: uid }),
            trans_status: 'pending',
            trans_status_update_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            result: null,
            id: nextId + 1 + queuedInfoCount
          });
          queuedInfoCount++;
        }
      }

      return res.json({
        success: true,
        message: `Sync command queued for device ${devId}. The machine will respond in ~3 seconds.`,
        transId,
        queuedInfoCount
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to queue sync command'
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
        getBiometricMongoStatus,
        getBiometricNamedCollection
      } = await import('../services/biometricMongo');

      const collection = await getBiometricCollection();
      const records = await collection
        .find({})
        .sort({ id: -1 })
        .limit(100)
        .toArray();

      const status = await getBiometricMongoStatus();

      // Sync MongoDB registered students and machine enrollments
      await store.syncBiometricData();

      // Fetch machine user names from user_info_result as fallback
      const machineNamesByBioId = new Map<string, string>();
      try {
        const userInfoCollection = await getBiometricNamedCollection('user_info_result');
        const infoRecords = await userInfoCollection.find({}).sort({ created_at: -1 }).toArray();
        for (const rec of infoRecords as any[]) {
          const uid = String(rec.user_id ?? '').trim();
          let info = rec.info;
          if (typeof info === 'string') {
            try { info = JSON.parse(info); } catch {}
          }
          if (uid && info?.user_name && !machineNamesByBioId.has(uid)) {
            machineNamesByBioId.set(uid, String(info.user_name));
            const num = parseInt(uid, 10);
            if (!isNaN(num)) machineNamesByBioId.set(String(num), String(info.user_name));
          }
        }
      } catch (err) {
        console.warn('Could not load user_info_result from MongoDB:', err);
      }

      // Normalized helper to match "00000028" with "28"
      const normalizeBioId = (id: string | null | undefined): string => {
        if (!id) return '';
        const s = String(id).trim();
        const n = parseInt(s, 10);
        return isNaN(n) ? s.toLowerCase() : String(n);
      };

      const studentsByBiometricId = new Map<string, any>();
      for (const student of store.students) {
        if (student.biometricId) {
          studentsByBiometricId.set(String(student.biometricId).trim(), student);
          studentsByBiometricId.set(normalizeBioId(student.biometricId), student);
        }
      }

      const punches = records.map((record: any) => {
        const biometricId = String(record.user_id ?? '').trim();
        const normId = normalizeBioId(biometricId);
        const student =
          studentsByBiometricId.get(biometricId) ||
          studentsByBiometricId.get(normId);
        const machineName =
          machineNamesByBioId.get(biometricId) ||
          machineNamesByBioId.get(normId);

        const studentName = student?.name || (machineName ? `${machineName}` : null);
        const enrollmentNo = student?.enrollmentNo || (machineName ? `BIO-${normId.padStart(4, '0')}` : null);
        const isRecognized = Boolean(student || machineName);

        // Record real biometric punch into live attendance ledger
        if (isRecognized && record.io_time) {
          const parts = String(record.io_time).split(' ');
          const pDate = parts[0];
          const pTime = parts[1] || '12:00:00';
          const sId = student?.id || `stu-bio-${normId}`;
          const attId = `att-bio-${sId}-${pDate.replace(/-/g, '')}`;

          if (!store.attendance.some((a) => a.id === attId)) {
            store.attendance.push({
              id: attId,
              studentId: sId,
              enrollmentNo: enrollmentNo || 'BIO-0000',
              studentName: studentName || 'Biometric Resident',
              hostelId: student?.hostelId || 'h-shivalik',
              block: student?.block || 'Block A',
              roomNumber: student?.roomNumber || '101',
              date: pDate,
              status: 'present',
              punchTime: pTime,
              biometricDeviceId: record.dev_id || 'RSS20241199684',
              isDefaulter: false,
              evaluatedAt: `${pDate} 22:00:00 IST`
            });
          }
        }

        return {
          id: record.id?.toString?.() ??
            String(record.id ?? record._id),
          biometricId,
          studentName,
          enrollmentNo,
          hostelId: student?.hostelId ?? 'h-shivalik',
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
          recognized: isRecognized
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



