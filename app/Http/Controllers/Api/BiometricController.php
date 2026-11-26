<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Device;
use App\Models\Notification;
use App\Models\Punch;
use App\Models\Student;
use App\Services\ClockService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use MongoDB\Driver\BulkWrite;
use MongoDB\Driver\Manager;
use MongoDB\Driver\Query;

class BiometricController extends Controller
{
    public function __construct(
        private ClockService $clockService
    ) {}

    private function checkDeviceHeartbeat(string $serial = 'RSS20241199684'): array
    {
        $logPath = 'C:/wamp64/www/SDK_Php_Mongo/SDK_Php_Mongo/request.log';
        $isOnline = false;
        $secondsAgo = null;

        if (file_exists($logPath)) {
            clearstatcache(true, $logPath);
            $mtime = filemtime($logPath);
            if ($mtime !== false) {
                $secondsAgo = time() - $mtime;
                // S362 machine pings index.php every 3 seconds.
                // If last heartbeat arrived within 15 seconds, device is online.
                $isOnline = ($secondsAgo <= 15);
            }
        }

        try {
            Device::where('device_serial', $serial)->update([
                'device_status' => $isOnline ? 'online_synced' : 'offline',
                'last_sync' => $isOnline ? now() : DB::raw('last_sync'),
            ]);
        } catch (\Throwable) {
        }

        return [
            'online' => $isOnline,
            'secondsAgo' => $secondsAgo,
            'serial' => $serial,
            'statusText' => $isOnline ? 'Connected (Online)' : 'Disconnected (Offline)',
        ];
    }

    private function checkBiometricAccess(Request $request, array $roles): mixed
    {
        $user = $request->user();
        $role = $user?->role?->name;

        if (! $user || ! in_array($role, $roles, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if ($user->isHostelScoped() && ! $user->hostel_id) {
            return response()->json([
                'success' => false,
                'message' => 'No hostel is assigned to this account.',
            ], 403);
        }

        return null;
    }

    public function devices(Request $request)
    {
        if ($response = $this->checkBiometricAccess($request, [
            'Admin',
            'Director',
            'Chief Warden',
            'Residential Warden',
            'Warden',
            'Caretaker',
            'Caretaker Operator',
        ])) {
            return $response;
        }

        $user = $request->user();
        $aliveInfo = $this->checkDeviceHeartbeat('RSS20241199684');

        $devicesQuery = Device::with('hostel');
        if ($user->isHostelScoped()) {
            $devicesQuery->where('hostel_id', $user->hostel_id);
        }

        $devices = $devicesQuery->get()->map(function ($device) use ($aliveInfo) {
            $isDeviceOnline = ($device->device_serial === 'RSS20241199684') ? $aliveInfo['online'] : false;
            $status = $isDeviceOnline ? 'online_synced' : ($device->device_status ?: 'standby');
            $studentCount = Student::where('hostel_id', $device->hostel_id)->count();

            return [
                'id' => (string) $device->id,
                'deviceId' => $device->device_serial,
                'name' => $device->device_name,
                'deviceName' => $device->device_name,
                'deviceSerial' => $device->device_serial,
                'hostelId' => (string) $device->hostel_id,
                'hostelName' => $device->hostel?->name ?? 'Unknown Hostel',
                'hostelCode' => $device->hostel?->code ?? '',
                'status' => $status,
                'ipAddress' => ($device->device_serial === 'RSS20241199684') ? '192.168.1.22' : '192.168.1.'.(22 + (int) $device->id),
                'lastSync' => $isDeviceOnline ? now()->toIso8601String() : $device->last_sync?->toIso8601String(),
                'lastSyncAt' => $isDeviceOnline ? now()->toIso8601String() : ($device->last_sync?->toIso8601String() ?? now()->toIso8601String()),
                'firmware' => 'S362 v3.15.630',
                'isOnline' => $isDeviceOnline,
                'heartbeatSecondsAgo' => $isDeviceOnline ? $aliveInfo['secondsAgo'] : null,
                'studentCount' => $studentCount,
            ];
        });

        return response()->json([
            'success' => true,
            'authorizedAdministrator' => 'Mr. Mehra (Computer Science Dept)',
            'devices' => $devices,
            'deviceStatus' => $aliveInfo,
        ]);
    }

    public function sync(Request $request)
    {
        $data = $request->validate([
            'deviceId' => ['required', 'string'],
            'punches' => ['required', 'array'],
            'punches.*.biometricId' => ['required', 'string'],
            'punches.*.punchTime' => ['nullable', 'string'],
            'punches.*.punchTimestamp' => ['nullable', 'string'],
        ]);

        $device = Device::where('id', $data['deviceId'])
            ->orWhere('device_serial', $data['deviceId'])
            ->first();

        if (! $device) {
            return response()->json([
                'success' => false,
                'message' => 'Specified biometric device not found.',
            ], 404);
        }

        $processed = 0;
        $duplicates = 0;
        $unrecognized = 0;
        $current = $this->clockService->current();

        DB::transaction(function () use ($data, $device, $current, &$processed, &$duplicates, &$unrecognized) {
            foreach ($data['punches'] as $punchItem) {
                $student = Student::where('biometric_id', $punchItem['biometricId'])->first();

                if (! $student) {
                    $unrecognized++;

                    continue;
                }

                $punchTime = $punchItem['punchTimestamp'] ?? ($current->toDateString().' '.($punchItem['punchTime'] ?? $current->format('H:i:s')));
                $parsedTime = Carbon::parse($punchTime, ClockService::TIMEZONE);

                $exists = Punch::where('student_id', $student->id)
                    ->where('punched_at', $parsedTime)
                    ->exists();

                if ($exists) {
                    $duplicates++;

                    continue;
                }

                Punch::create([
                    'student_id' => $student->id,
                    'device_id' => $device->id,
                    'punched_at' => $parsedTime,
                    'synced_at' => $current,
                ]);

                $processed++;
            }

            $device->update(['last_sync' => $current]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Biometric punches synchronized successfully.',
            'deviceId' => (string) $device->id,
            'processedCount' => $processed,
            'duplicateCount' => $duplicates,
            'unrecognizedCount' => $unrecognized,
            'lastSyncAt' => $current->toIso8601String(),
        ]);
    }

    public function health(Request $request)
    {
        $devices = Device::all();
        $totalDevices = $devices->count();
        $staleThreshold = Carbon::now()->subHours(24);

        $staleDevices = $devices->filter(fn ($d) => ! $d->last_sync || $d->last_sync < $staleThreshold)->values();
        $syncedDevices = $totalDevices - $staleDevices->count();

        $missingParentEmails = Student::whereNull('parent_email')
            ->orWhere('parent_email', '')
            ->with('hostel', 'room')
            ->get()
            ->map(fn ($s) => [
                'id' => (string) $s->id,
                'name' => $s->user?->name ?? 'Student '.$s->enrollment_no,
                'enrollmentNo' => $s->enrollment_no,
                'hostel' => $s->hostel?->name ?? '',
                'room' => $s->room?->room_number ?? '',
            ]);

        $failedNotifications = Notification::where('delivery_status', 'failed')
            ->latest('created_at')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'systemHealth' => $staleDevices->isEmpty() ? 'Optimal' : 'Attention Required',
            'totalDevices' => $totalDevices,
            'syncedDevices' => $syncedDevices,
            'staleDevicesCount' => $staleDevices->count(),
            'staleDevices' => $staleDevices,
            'missingParentEmailsCount' => $missingParentEmails->count(),
            'missingParentEmails' => $missingParentEmails,
            'notificationFailuresCount' => $failedNotifications->count(),
            'notificationFailures' => $failedNotifications,
        ]);
    }

    public function enrolledUsers(Request $request)
    {
        if ($response = $this->checkBiometricAccess($request, [
            'Admin',
            'Director',
            'Chief Warden',
            'Residential Warden',
            'Warden',
            'Caretaker',
            'Caretaker Operator',
        ])) {
            return $response;
        }

        $currentUser = $request->user();

        // 1. Fetch devices and hostels from MySQL
        $allDevices = Device::with('hostel')->get();
        $deviceBySerial = $allDevices->keyBy('device_serial');
        $deviceByHostelId = $allDevices->keyBy('hostel_id');

        // 2. Fetch all registered students from MySQL
        $students = Student::with('user', 'hostel', 'room')->get();
        $studentsByBioId = [];
        foreach ($students as $s) {
            $raw = trim((string) $s->biometric_id);
            $clean = ltrim($raw, '0') ?: $raw;
            $studentsByBioId[$raw] = $s;
            $studentsByBioId[$clean] = $s;
        }

        $idDocs = [];
        $infoMap = [];

        try {
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new Manager($mongoUri);

            $idQuery = new Query([], ['sort' => ['_id' => -1]]);
            $idDocs = iterator_to_array($manager->executeQuery('biometric_db.get_user_id', $idQuery));

            $infoQuery = new Query([], ['sort' => ['created_at' => -1, '_id' => -1]]);
            $infoDocs = iterator_to_array($manager->executeQuery('biometric_db.user_info_result', $infoQuery));

            foreach ($infoDocs as $doc) {
                $uid = trim((string) ($doc->user_id ?? ''));
                if (! $uid) {
                    continue;
                }
                $infoObj = is_string($doc->info ?? null) ? json_decode($doc->info) : ($doc->info ?? null);
                $mName = $infoObj->user_name ?? ($doc->name ?? null);
                $cleanName = (! empty(trim((string) $mName))) ? trim((string) $mName) : null;
                $privilege = $infoObj->user_privilege ?? ($infoObj->privilege ?? ($doc->privilege ?? null));

                $enrollArray = is_array($infoObj->enroll_data_array ?? null) ? $infoObj->enroll_data_array : [];
                $fpSlots = 0;
                foreach ($enrollArray as $item) {
                    $slot = $item->backup_number ?? null;
                    if (is_numeric($slot) && (int) $slot >= 0 && (int) $slot <= 9 && ! empty($item->enroll_data)) {
                        $fpSlots++;
                    }
                }

                $hasFp = $fpSlots > 0 || ! empty($doc->backup_number) || ! empty($doc->raw_size) || ! empty($doc->fp_template_size);
                $fpCount = $fpSlots > 0 ? $fpSlots : (! empty($doc->backup_number) || ! empty($doc->raw_size) ? 1 : 0);

                if (! isset($infoMap[$uid])) {
                    $infoMap[$uid] = [
                        'name' => $cleanName,
                        'privilege' => $privilege ?: 'User',
                        'hasFingerprint' => $hasFp,
                        'fingerprintCount' => $fpCount,
                        'hasInfo' => true,
                    ];
                } else {
                    if ($infoMap[$uid]['name'] === null && $cleanName !== null) {
                        $infoMap[$uid]['name'] = $cleanName;
                    }
                    if ($infoMap[$uid]['privilege'] === 'User' && $privilege) {
                        $infoMap[$uid]['privilege'] = $privilege;
                    }
                    $infoMap[$uid]['hasFingerprint'] = $infoMap[$uid]['hasFingerprint'] || $hasFp;
                    $infoMap[$uid]['fingerprintCount'] = max($infoMap[$uid]['fingerprintCount'], $fpCount);
                }
            }
        } catch (\Throwable $e) {
            \Log::warning('MongoDB read skipped in enrolledUsers: '.$e->getMessage());
        }

        $users = [];
        $seenUserIds = [];

        // Process machine users from MongoDB
        foreach ($idDocs as $doc) {
            $uid = trim((string) ($doc->user_id ?? ''));
            if (! $uid || $uid === '0') {
                continue;
            }
            $cleanUid = ltrim($uid, '0') ?: $uid;
            $seenUserIds[$uid] = true;
            $seenUserIds[$cleanUid] = true;

            $student = $studentsByBioId[$uid] ?? ($studentsByBioId[$cleanUid] ?? null);
            $info = $infoMap[$uid] ?? ($infoMap[$cleanUid] ?? [
                'name' => null,
                'privilege' => 'User',
                'hasFingerprint' => false,
                'fingerprintCount' => 0,
                'hasInfo' => false,
            ]);

            $devSerial = $doc->dev_id ?? 'RSS20241199684';
            $matchedDev = $deviceBySerial->get($devSerial);

            // Determine hostel: student's hostel takes priority, then device's hostel
            $hostelId = $student ? (string) $student->hostel_id : ($matchedDev ? (string) $matchedDev->hostel_id : '1');
            $hostelName = $student?->hostel?->name ?? ($matchedDev?->hostel?->name ?? 'Boys Hostel 1');
            $hostelCode = $student?->hostel?->code ?? ($matchedDev?->hostel?->code ?? 'BH1');

            // Determine resolved name: MySQL student user name takes priority over raw machine string
            $resolvedName = ($student && $student->user && ! empty(trim((string) $student->user->name)))
                ? trim($student->user->name)
                : $info['name'];

            $users[] = [
                'userId' => $uid,
                'deviceSerial' => $devSerial,
                'deviceName' => $matchedDev?->device_name ?? 'Biometric Terminal',
                'name' => $resolvedName,
                'hostelId' => $hostelId,
                'hostelName' => $hostelName,
                'hostelCode' => $hostelCode,
                'privilege' => $info['privilege'],
                'fingerprintEnrolled' => $info['hasFingerprint'] || ($student !== null),
                'fingerprintCount' => $info['fingerprintCount'] > 0 ? $info['fingerprintCount'] : ($student ? 1 : 0),
                'hasInfo' => $info['hasInfo'] || ($student !== null),
                'isRegistered' => ($student !== null),
                'studentId' => $student ? (string) $student->id : null,
                'enrollmentNo' => $student?->enrollment_no,
                'roomNumber' => $student?->room?->room_number,
                'bedNumber' => $student?->bed_number,
            ];
        }

        // Also include registered students from MySQL that were not in MongoDB get_user_id yet
        foreach ($students as $student) {
            $raw = trim((string) $student->biometric_id);
            $clean = ltrim($raw, '0') ?: $raw;

            if (isset($seenUserIds[$raw]) || isset($seenUserIds[$clean])) {
                continue;
            }

            $seenUserIds[$raw] = true;
            $seenUserIds[$clean] = true;

            $matchedDev = $deviceByHostelId->get($student->hostel_id) ?? $allDevices->first();

            $users[] = [
                'userId' => $raw,
                'deviceSerial' => $matchedDev?->device_serial ?? 'RSS20241199684',
                'deviceName' => $matchedDev?->device_name ?? 'Biometric Terminal',
                'name' => $student->user?->name ?? "Student {$student->enrollment_no}",
                'hostelId' => (string) $student->hostel_id,
                'hostelName' => $student->hostel?->name ?? 'Boys Hostel 1',
                'hostelCode' => $student->hostel?->code ?? 'BH1',
                'privilege' => 'User',
                'fingerprintEnrolled' => true,
                'fingerprintCount' => 1,
                'hasInfo' => true,
                'isRegistered' => true,
                'studentId' => (string) $student->id,
                'enrollmentNo' => $student->enrollment_no,
                'roomNumber' => $student->room?->room_number,
                'bedNumber' => $student->bed_number,
            ];
        }

        // Sort users numerically by userId
        usort($users, function ($a, $b) {
            $numA = (int) $a['userId'];
            $numB = (int) $b['userId'];

            return $numA <=> $numB;
        });

        if ($currentUser->isHostelScoped()) {
            $scopedHostelId = (string) $currentUser->hostel_id;
            $users = array_values(array_filter(
                $users,
                fn (array $user): bool => (string) ($user['hostelId'] ?? '') === $scopedHostelId
            ));
        }

        return response()->json([
            'success' => true,
            'count' => count($users),
            'users' => $users,
        ]);
    }

    public function triggerUserFetch(Request $request)
    {
        if ($response = $this->checkBiometricAccess($request, [
            'Admin',
            'Caretaker',
            'Caretaker Operator',
        ])) {
            return $response;
        }

        try {
            $currentUser = $request->user();
            $defaultSerial = 'RSS20241199684';
            if ($currentUser->isHostelScoped()) {
                $assignedDevice = Device::where('hostel_id', $currentUser->hostel_id)->first();
                $defaultSerial = $assignedDevice?->device_serial ?? $defaultSerial;
            }

            $devId = $request->input('deviceId', $defaultSerial);

            if ($currentUser->isHostelScoped()) {
                $targetDevice = Device::where('device_serial', $devId)->first();
                if (! $targetDevice || (int) $targetDevice->hostel_id !== (int) $currentUser->hostel_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'You can only sync the biometric device assigned to your hostel.',
                    ], 403);
                }
            }

            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new Manager($mongoUri);

            $maxTransId = 100000;
            $maxId = 0;
            $cmdQuery = new Query([], ['projection' => ['trans_id' => 1, 'id' => 1]]);
            foreach ($manager->executeQuery('biometric_db.command_request_pending', $cmdQuery) as $cDoc) {
                $t = $cDoc->trans_id ?? null;
                if (is_numeric($t)) {
                    $tInt = (int) $t;
                    if ($tInt < 1000000000 && $tInt > $maxTransId) {
                        $maxTransId = $tInt;
                    }
                }
                $cId = $cDoc->id ?? null;
                if (is_numeric($cId) && (int) $cId > $maxId) {
                    $maxId = (int) $cId;
                }
            }

            $baseTransId = $maxTransId + 1;
            $nextId = $maxId + 1;
            $bulk = new BulkWrite;
            $transId = (string) $baseTransId;

            $bulk->insert([
                'trans_id' => $transId,
                'dev_id' => $devId,
                'cmd_code' => 'GET_USER_ID_LIST',
                'cmd_param' => '{}',
                'trans_status' => 'pending',
                'trans_status_update_time' => now()->format('Y-m-d H:i:s'),
                'result' => null,
                'id' => $nextId,
            ]);

            $idQuery = new Query(['dev_id' => $devId]);
            $idDocs = iterator_to_array($manager->executeQuery('biometric_db.get_user_id', $idQuery));

            $infoQuery = new Query(['dev_id' => $devId]);
            $infoDocs = iterator_to_array($manager->executeQuery('biometric_db.user_info_result', $infoQuery));
            $resolvedUserIds = [];
            foreach ($infoDocs as $infoDoc) {
                $iUid = trim((string) ($infoDoc->user_id ?? ''));
                $infoObj = is_string($infoDoc->info ?? null) ? json_decode($infoDoc->info) : ($infoDoc->info ?? null);
                $hasName = ! empty(trim((string) ($infoObj->user_name ?? ($infoDoc->name ?? ''))));
                if ($iUid !== '' && $hasName) {
                    $resolvedUserIds[$iUid] = true;
                }
            }

            $queuedCount = 0;
            $seenUids = [];
            foreach ($idDocs as $doc) {
                $uid = trim((string) ($doc->user_id ?? ''));
                if ($uid && $uid !== '0' && ! isset($seenUids[$uid]) && ! isset($resolvedUserIds[$uid])) {
                    $seenUids[$uid] = true;
                    $queuedCount++;
                    $bulk->insert([
                        'trans_id' => (string) ($baseTransId + $queuedCount),
                        'dev_id' => $devId,
                        'cmd_code' => 'GET_USER_INFO',
                        'cmd_param' => json_encode(['user_id' => $uid]),
                        'trans_status' => 'pending',
                        'trans_status_update_time' => now()->format('Y-m-d H:i:s'),
                        'result' => null,
                        'id' => $nextId + $queuedCount,
                    ]);
                }
            }

            $manager->executeBulkWrite('biometric_db.command_request_pending', $bulk);

            return response()->json([
                'success' => true,
                'message' => "Sync command queued for device {$devId}. The machine will respond in ~3 seconds.",
                'transId' => $transId,
                'queuedCount' => $queuedCount,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to queue sync command: '.$e->getMessage(),
            ], 503);
        }
    }

    public function live(Request $request)
    {
        if ($response = $this->checkBiometricAccess($request, [
            'Admin',
            'Director',
            'Chief Warden',
            'Residential Warden',
            'Warden',
            'Caretaker',
            'Caretaker Operator',
        ])) {
            return $response;
        }

        try {
            $currentUser = $request->user();
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new Manager($mongoUri);

            $glogQuery = new Query([], ['sort' => ['id' => -1], 'limit' => 100]);
            $records = iterator_to_array($manager->executeQuery('biometric_db.glog_data', $glogQuery));

            $students = Student::with('user', 'hostel')->get();
            $studentsByBioId = [];
            foreach ($students as $s) {
                $raw = trim((string) $s->biometric_id);
                $clean = ltrim($raw, '0') ?: $raw;
                $studentsByBioId[$raw] = $s;
                $studentsByBioId[$clean] = $s;
            }

            $infoQuery = new Query([], ['sort' => ['created_at' => -1]]);
            $infoDocs = iterator_to_array($manager->executeQuery('biometric_db.user_info_result', $infoQuery));
            $machineNames = [];
            foreach ($infoDocs as $rec) {
                $uid = trim((string) ($rec->user_id ?? ''));
                if (! $uid) {
                    continue;
                }
                $infoObj = is_string($rec->info ?? null) ? json_decode($rec->info) : ($rec->info ?? null);
                if (! isset($machineNames[$uid]) && ! empty($infoObj->user_name)) {
                    $machineNames[$uid] = (string) $infoObj->user_name;
                    $machineNames[ltrim($uid, '0') ?: $uid] = (string) $infoObj->user_name;
                }
            }

            $allDevices = Device::with('hostel')->get();
            $deviceBySerial = $allDevices->keyBy('device_serial');

            $punches = [];
            foreach ($records as $record) {
                $bioId = trim((string) ($record->user_id ?? ''));
                $cleanId = ltrim($bioId, '0') ?: $bioId;

                $student = $studentsByBioId[$bioId] ?? ($studentsByBioId[$cleanId] ?? null);
                $machineName = $machineNames[$bioId] ?? ($machineNames[$cleanId] ?? null);

                $devSerial = $record->dev_id ?? 'RSS20241199684';
                $matchedDev = $deviceBySerial->get($devSerial) ?? $allDevices->first();

                $hostelId = $student ? (string) $student->hostel_id : ($matchedDev ? (string) $matchedDev->hostel_id : '1');
                if ($currentUser->isHostelScoped() && $hostelId !== (string) $currentUser->hostel_id) {
                    continue;
                }

                $hostelName = $student?->hostel?->name ?? ($matchedDev?->hostel?->name ?? 'Boys Hostel 1');
                $hostelCode = $student?->hostel?->code ?? ($matchedDev?->hostel?->code ?? 'BH1');

                $studentName = $student?->user?->name ?? ($machineName ?? null);
                $enrollmentNo = $student?->enrollment_no ?? ($machineName ? 'BIO-'.str_pad($cleanId, 4, '0', STR_PAD_LEFT) : null);
                $isRecognized = ($student !== null || $machineName !== null);

                if ($student && ! empty($record->io_time)) {
                    try {
                        $punchAt = Carbon::parse($record->io_time, ClockService::TIMEZONE);
                        Punch::firstOrCreate(
                            [
                                'student_id' => $student->id,
                                'punched_at' => $punchAt,
                            ],
                            [
                                'device_id' => $matchedDev?->id ?? 1,
                                'synced_at' => now(),
                            ]
                        );

                        $attDate = $punchAt->toDateString();
                        $cutoff = Carbon::parse($attDate.' 21:00:00', ClockService::TIMEZONE);
                        $status = $punchAt->gt($cutoff) ? 'late' : 'present';

                        Attendance::updateOrCreate(
                            [
                                'student_id' => $student->id,
                                'attendance_date' => $attDate,
                            ],
                            [
                                'punch_time' => $punchAt->toTimeString(),
                                'status' => $status,
                                'is_defaulter' => false,
                                'remarks' => 'Biometric machine punch',
                            ]
                        );
                    } catch (\Throwable) {
                    }
                }

                $ioMode = (string) ($record->io_mode ?? '');
                $direction = ($ioMode === '1') ? 'IN' : (($ioMode === '0') ? 'OUT' : 'UNKNOWN');

                $punches[] = [
                    'id' => (string) ($record->id ?? ($record->_id ?? uniqid())),
                    'biometricId' => $bioId,
                    'studentName' => $studentName,
                    'enrollmentNo' => $enrollmentNo,
                    'hostelId' => $hostelId,
                    'hostelName' => $hostelName,
                    'hostelCode' => $hostelCode,
                    'deviceName' => $matchedDev?->device_name ?? 'Biometric Terminal',
                    'deviceSerial' => $devSerial,
                    'verifyMode' => $record->verify_mode ?? null,
                    'ioMode' => $record->io_mode ?? null,
                    'direction' => $direction,
                    'punchTime' => $record->io_time ?? null,
                    'recognized' => $isRecognized,
                ];
            }

            $aliveInfo = $this->checkDeviceHeartbeat('RSS20241199684');

            return response()->json([
                'success' => true,
                'mongo' => ['connected' => true, 'database' => 'biometric_db', 'collection' => 'glog_data'],
                'device' => $aliveInfo,
                'total' => count($punches),
                'punches' => $punches,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to read biometric records: '.$e->getMessage(),
            ], 503);
        }
    }
}
