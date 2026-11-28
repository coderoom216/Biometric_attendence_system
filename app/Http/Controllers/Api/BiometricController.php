<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Device;
use App\Models\Notification;
use App\Models\Punch;
use App\Models\Student;
use App\Services\AuditService;
use App\Services\ClockService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
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

        $devices = $devicesQuery->get()->map(
            fn (Device $device): array => $this->formatDevice($device, $aliveInfo)
        );

        return response()->json([
            'success' => true,
            'authorizedAdministrator' => 'Mr. Mehra (Computer Science Dept)',
            'devices' => $devices,
            'deviceStatus' => $aliveInfo,
        ]);
    }

    /**
     * Update biometric terminal details (Model No, Name, Serial, IP, Firmware, Location, Hostel, Status).
     */
    public function updateDevice(Request $request, int $id)
    {
        if ($response = $this->checkBiometricAccess($request, [
            'Admin',
            'Caretaker Operator',
        ])) {
            return $response;
        }

        $device = Device::with('hostel')->findOrFail($id);

        $validated = $request->validate([
            'deviceName' => ['sometimes', 'required', 'string', 'max:255'],
            'deviceSerial' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('devices', 'device_serial')->ignore($device->id),
            ],
            'modelNo' => ['sometimes', 'nullable', 'string', 'max:100'],
            'ipAddress' => ['sometimes', 'nullable', 'string', 'max:45'],
            'firmwareVersion' => ['sometimes', 'nullable', 'string', 'max:100'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'hostelId' => [
                'sometimes',
                'required',
                'integer',
                'exists:hostels,id',
                Rule::unique('devices', 'hostel_id')->ignore($device->id),
            ],
            'deviceStatus' => [
                'sometimes',
                'required',
                Rule::in(['active', 'inactive', 'online_synced', 'standby', 'offline']),
            ],
        ]);

        $updates = [];
        if (array_key_exists('deviceName', $validated)) {
            $updates['device_name'] = trim($validated['deviceName']);
        }
        if (array_key_exists('deviceSerial', $validated)) {
            $updates['device_serial'] = trim($validated['deviceSerial']);
        }
        if (array_key_exists('modelNo', $validated)) {
            $updates['model_no'] = $validated['modelNo'] !== null ? trim($validated['modelNo']) : null;
        }
        if (array_key_exists('ipAddress', $validated)) {
            $updates['ip_address'] = $validated['ipAddress'] !== null ? trim($validated['ipAddress']) : null;
        }
        if (array_key_exists('firmwareVersion', $validated)) {
            $updates['firmware_version'] = $validated['firmwareVersion'] !== null ? trim($validated['firmwareVersion']) : null;
        }
        if (array_key_exists('location', $validated)) {
            $updates['location'] = $validated['location'] !== null ? trim($validated['location']) : null;
        }
        if (array_key_exists('hostelId', $validated)) {
            $updates['hostel_id'] = (int) $validated['hostelId'];
        }
        if (array_key_exists('deviceStatus', $validated)) {
            $updates['device_status'] = $validated['deviceStatus'];
        }

        if (! empty($updates)) {
            $device->update($updates);

            app(AuditService::class)->log(
                'Biometric Terminal Updated',
                'Device',
                $device->id,
                'Updated terminal '.$device->device_name.' (Model: '.($device->model_no ?: 'S362').', Serial: '.$device->device_serial.')',
                $request->user()->id
            );
        }

        $aliveInfo = $this->checkDeviceHeartbeat('RSS20241199684');

        return response()->json([
            'success' => true,
            'message' => 'Biometric terminal updated successfully.',
            'device' => $this->formatDevice($device->fresh('hostel'), $aliveInfo),
        ]);
    }

    /**
     * Format a biometric terminal record consistently for dashboard views.
     *
     * @param  array<string, mixed>  $aliveInfo
     * @return array<string, mixed>
     */
    private function formatDevice(Device $device, array $aliveInfo): array
    {
        $isDeviceOnline = ($device->device_serial === ($aliveInfo['serial'] ?? 'RSS20241199684'))
            ? (bool) ($aliveInfo['online'] ?? false)
            : false;
        $status = $isDeviceOnline ? 'online_synced' : ($device->device_status ?: 'standby');
        $studentCount = Student::where('hostel_id', $device->hostel_id)->count();
        $modelNo = $device->model_no ?: 'S362';
        $ipAddress = $device->ip_address ?: (($device->device_serial === 'RSS20241199684') ? '192.168.1.22' : '192.168.1.'.(22 + (int) $device->id));

        return [
            'id' => (string) $device->id,
            'deviceId' => $device->device_serial,
            'name' => $device->device_name,
            'deviceName' => $device->device_name,
            'deviceSerial' => $device->device_serial,
            'modelNo' => $modelNo,
            'hostelId' => (string) $device->hostel_id,
            'hostelName' => $device->hostel?->name ?? 'Unknown Hostel',
            'hostelCode' => $device->hostel?->code ?? '',
            'status' => $status,
            'deviceStatus' => $device->device_status,
            'ipAddress' => $ipAddress,
            'location' => $device->location,
            'lastSync' => $isDeviceOnline ? now()->toIso8601String() : $device->last_sync?->toIso8601String(),
            'lastSyncAt' => $isDeviceOnline ? now()->toIso8601String() : ($device->last_sync?->toIso8601String() ?? now()->toIso8601String()),
            'firmware' => $device->firmware_version ?: "{$modelNo} v3.15.630",
            'isOnline' => $isDeviceOnline,
            'heartbeatSecondsAgo' => $isDeviceOnline ? ($aliveInfo['secondsAgo'] ?? null) : null,
            'studentCount' => $studentCount,
        ];
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
                $rawBioId = trim((string) $punchItem['biometricId']);
                $cleanBioId = ltrim($rawBioId, '0') ?: $rawBioId;
                $candidates = array_values(array_unique(array_filter([
                    $rawBioId,
                    $cleanBioId,
                    str_pad($cleanBioId, 8, '0', STR_PAD_LEFT),
                ])));
                $student = Student::whereIn('biometric_id', $candidates)->first();

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
        $devices = Device::with('hostel')->get();
        $totalDevices = $devices->count();
        $staleThreshold = Carbon::now()->subHours(24);

        $staleDeviceModels = $devices->filter(fn ($d) => ! $d->last_sync || $d->last_sync < $staleThreshold)->values();
        $syncedDevices = $totalDevices - $staleDeviceModels->count();

        $staleDevices = $staleDeviceModels->map(fn (Device $d): array => [
            'id' => (string) $d->id,
            'deviceSerial' => $d->device_serial,
            'name' => $d->device_name,
            'location' => $d->location ?: ($d->hostel?->name ?? 'Hostel Gate'),
            'lastSync' => $d->last_sync ? $d->last_sync->format('Y-m-d H:i:s') : 'Never synced',
        ])->values();

        $missingParentEmails = Student::whereNull('parent_email')
            ->orWhere('parent_email', '')
            ->with('user', 'hostel', 'room')
            ->get()
            ->map(fn ($s) => [
                'id' => (string) $s->id,
                'name' => $s->user?->name ?? 'Student '.$s->enrollment_no,
                'enrollmentNo' => $s->enrollment_no,
                'hostel' => $s->hostel?->name ?? '',
                'room' => $s->room?->room_number ?? '',
            ]);

        $failedNotifications = Notification::where('delivery_status', 'failed')
            ->with(['alert.student.user', 'alert.alertTier'])
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(function (Notification $n): array {
                $student = $n->alert?->student;
                $timestamp = $n->sent_at ?? $n->alert?->triggered_at ?? now();

                return [
                    'id' => (string) $n->id,
                    'studentId' => (string) ($student?->id ?? ''),
                    'studentName' => $student?->user?->name ?? 'Unknown Student',
                    'enrollmentNo' => $student?->enrollment_no ?? '',
                    'tier' => (int) ($n->alert?->tier_id ?? 1),
                    'recipientRole' => $n->alert?->alertTier?->tier_name ?? 'Parent / Staff',
                    'recipientEmail' => $n->recipient,
                    'channel' => strtolower((string) $n->channel),
                    'status' => strtolower((string) $n->delivery_status),
                    'failureReason' => $n->error_message ?: 'Notification delivery failed.',
                    'timestamp' => $timestamp->format('Y-m-d H:i:s'),
                ];
            })
            ->values();

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
        $glogDocs = [];

        try {
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new Manager($mongoUri);

            $idQuery = new Query([], ['sort' => ['_id' => -1]]);
            $idDocs = iterator_to_array($manager->executeQuery('biometric_db.get_user_id', $idQuery));

            $infoQuery = new Query([], ['sort' => ['created_at' => -1, '_id' => -1]]);
            $infoDocs = iterator_to_array($manager->executeQuery('biometric_db.user_info_result', $infoQuery));

            $glogQuery = new Query([], ['sort' => ['_id' => -1], 'limit' => 50]);
            $glogDocs = iterator_to_array($manager->executeQuery('biometric_db.glog_data', $glogQuery));

            foreach ($infoDocs as $doc) {
                $uid = trim((string) ($doc->user_id ?? ''));
                if (! $uid) {
                    continue;
                }
                $infoObj = is_string($doc->info ?? null) ? json_decode($doc->info) : ($doc->info ?? null);
                $mName = $infoObj->user_name ?? ($doc->name ?? null);
                $cleanName = (! empty(trim((string) $mName))) ? trim((string) $mName) : null;
                $privilege = $infoObj->user_privilege ?? ($infoObj->privilege ?? ($doc->privilege ?? null));
                $docDev = trim((string) ($doc->dev_id ?? '')) ?: 'RSS20241199684';

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
                $infoTs = $this->extractMongoTimestamp($doc);

                if (! isset($infoMap[$uid])) {
                    $infoMap[$uid] = [
                        'name' => $cleanName,
                        'privilege' => $privilege ?: 'User',
                        'hasFingerprint' => $hasFp,
                        'fingerprintCount' => $fpCount,
                        'hasInfo' => true,
                        'timestamp' => $infoTs,
                        'devId' => $docDev,
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
                    $infoMap[$uid]['timestamp'] = max($infoMap[$uid]['timestamp'], $infoTs);
                }
            }
        } catch (\Throwable $e) {
            \Log::warning('MongoDB read skipped in enrolledUsers: '.$e->getMessage());
        }

        $users = [];
        $seenUserIds = [];
        $missingInfoTargets = [];

        // 1. Process machine users from get_user_id (most recent first)
        foreach ($idDocs as $doc) {
            $uid = trim((string) ($doc->user_id ?? ''));
            if (! $uid || $uid === '0') {
                continue;
            }
            $cleanUid = ltrim($uid, '0') ?: $uid;
            if (isset($seenUserIds[$uid]) || isset($seenUserIds[$cleanUid])) {
                continue;
            }
            $seenUserIds[$uid] = true;
            $seenUserIds[$cleanUid] = true;

            $student = $studentsByBioId[$uid] ?? ($studentsByBioId[$cleanUid] ?? null);
            $info = $infoMap[$uid] ?? ($infoMap[$cleanUid] ?? [
                'name' => null,
                'privilege' => 'User',
                'hasFingerprint' => false,
                'fingerprintCount' => 0,
                'hasInfo' => false,
                'timestamp' => 0,
            ]);

            $devSerial = $doc->dev_id ?? ($info['devId'] ?? 'RSS20241199684');
            $matchedDev = $deviceBySerial->get($devSerial);

            if (! $info['hasInfo'] && count($missingInfoTargets) < 15) {
                $missingInfoTargets[$devSerial.'|'.$uid] = [
                    'dev_id' => $devSerial,
                    'user_id' => $uid,
                ];
            }

            $sortTimestamp = max(
                $this->extractMongoTimestamp($doc),
                (int) ($info['timestamp'] ?? 0),
                $student?->created_at?->timestamp ?? 0
            );

            $users[] = $this->buildMachineUserEntry($uid, $devSerial, $student, $info, $matchedDev, $sortTimestamp);
        }

        // 2. Include recently fetched machine users already in user_info_result (before get_user_id refreshes)
        foreach ($infoMap as $uid => $info) {
            $uidStr = trim((string) $uid);
            $cleanUid = ltrim($uidStr, '0') ?: $uidStr;
            if (! $uidStr || $uidStr === '0' || isset($seenUserIds[$uidStr]) || isset($seenUserIds[$cleanUid])) {
                continue;
            }
            $seenUserIds[$uidStr] = true;
            $seenUserIds[$cleanUid] = true;

            $student = $studentsByBioId[$uidStr] ?? ($studentsByBioId[$cleanUid] ?? null);
            $devSerial = $info['devId'] ?? 'RSS20241199684';
            $matchedDev = $deviceBySerial->get($devSerial);
            $sortTimestamp = max((int) ($info['timestamp'] ?? 0), $student?->created_at?->timestamp ?? 0);

            $users[] = $this->buildMachineUserEntry($uidStr, $devSerial, $student, $info, $matchedDev, $sortTimestamp);
        }

        // 3. Include recent glog_data machine IDs not yet in get_user_id or user_info_result, and queue fetch
        foreach ($glogDocs as $gDoc) {
            $uid = trim((string) ($gDoc->user_id ?? ''));
            $cleanUid = ltrim($uid, '0') ?: $uid;
            if (! $uid || $uid === '0' || isset($seenUserIds[$uid]) || isset($seenUserIds[$cleanUid])) {
                continue;
            }
            $seenUserIds[$uid] = true;
            $seenUserIds[$cleanUid] = true;

            $student = $studentsByBioId[$uid] ?? ($studentsByBioId[$cleanUid] ?? null);
            $devSerial = trim((string) ($gDoc->dev_id ?? '')) ?: 'RSS20241199684';
            $matchedDev = $deviceBySerial->get($devSerial);

            if (count($missingInfoTargets) < 15) {
                $missingInfoTargets[$devSerial.'|'.$uid] = [
                    'dev_id' => $devSerial,
                    'user_id' => $uid,
                ];
            }

            $emptyInfo = [
                'name' => null,
                'privilege' => 'User',
                'hasFingerprint' => false,
                'fingerprintCount' => 0,
                'hasInfo' => false,
                'timestamp' => 0,
            ];
            $sortTimestamp = max($this->extractMongoTimestamp($gDoc), $student?->created_at?->timestamp ?? 0);

            $users[] = $this->buildMachineUserEntry($uid, $devSerial, $student, $emptyInfo, $matchedDev, $sortTimestamp);
        }

        if (isset($manager)) {
            if (! empty($missingInfoTargets)) {
                $this->queueMissingUserInfoCommands($manager, array_values($missingInfoTargets));
            }

            if (! app()->runningUnitTests()) {
                $discoverySerial = $currentUser->isHostelScoped()
                    ? ($deviceByHostelId->get($currentUser->hostel_id)?->device_serial ?? 'RSS20241199684')
                    : ($allDevices->first()?->device_serial ?? 'RSS20241199684');
                $this->queuePeriodicUserIdDiscovery($manager, $discoverySerial);
            }
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
                '_sortTimestamp' => $student->created_at?->timestamp ?? 0,
            ];
        }

        // Sort most recently discovered/enrolled users first, falling back to higher numeric userId
        usort($users, function (array $a, array $b): int {
            $timeCmp = ($b['_sortTimestamp'] ?? 0) <=> ($a['_sortTimestamp'] ?? 0);
            if ($timeCmp !== 0) {
                return $timeCmp;
            }

            return (int) $b['userId'] <=> (int) $a['userId'];
        });

        $users = array_map(function (array $user): array {
            unset($user['_sortTimestamp']);

            return $user;
        }, $users);

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

            [$baseTransId, $nextId] = $this->nextSequentialCommandIds($manager);
            $bulk = new BulkWrite;
            $queuedCommands = 0;
            $transId = (string) $baseTransId;
            $nowTimestamp = now()->timestamp;

            $pendingQuery = new Query([
                'dev_id' => $devId,
                'cmd_code' => ['$in' => ['GET_USER_ID_LIST', 'GET_USER_INFO']],
            ]);
            $hasRecentIdList = false;
            $activeOrRecentInfoIds = [];

            foreach ($manager->executeQuery('biometric_db.command_request_pending', $pendingQuery) as $pDoc) {
                $status = strtolower((string) ($pDoc->trans_status ?? ''));
                $queuedAt = $this->extractMongoTimestamp($pDoc);
                $isActiveOrRecent = in_array($status, ['pending', 'running'], true)
                    || ($queuedAt > 0 && $queuedAt <= $nowTimestamp && ($nowTimestamp - $queuedAt) < 15);

                if (! $isActiveOrRecent) {
                    continue;
                }

                if (($pDoc->cmd_code ?? '') === 'GET_USER_ID_LIST') {
                    $hasRecentIdList = true;
                } elseif (($pDoc->cmd_code ?? '') === 'GET_USER_INFO') {
                    $paramObj = is_string($pDoc->cmd_param ?? null) ? json_decode($pDoc->cmd_param) : ($pDoc->cmd_param ?? null);
                    $pUid = trim((string) ($paramObj->user_id ?? ''));
                    if ($pUid !== '') {
                        $activeOrRecentInfoIds[$pUid] = true;
                    }
                }
            }

            if (! $hasRecentIdList) {
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
                $queuedCommands++;
            }

            $idQuery = new Query(['dev_id' => $devId], ['sort' => ['_id' => -1]]);
            $idDocs = iterator_to_array($manager->executeQuery('biometric_db.get_user_id', $idQuery));

            $infoQuery = new Query(['dev_id' => $devId]);
            $infoDocs = iterator_to_array($manager->executeQuery('biometric_db.user_info_result', $infoQuery));
            $resolvedUserIds = [];
            $forceRefresh = $request->boolean('force');

            foreach ($infoDocs as $infoDoc) {
                $iUid = trim((string) ($infoDoc->user_id ?? ''));
                if ($iUid === '') {
                    continue;
                }
                $infoObj = is_string($infoDoc->info ?? null) ? json_decode($infoDoc->info) : ($infoDoc->info ?? null);
                $hasName = ! empty(trim((string) ($infoObj->user_name ?? ($infoDoc->name ?? ''))));
                $hasPayload = ! empty($infoDoc->raw_size)
                    || ! empty($infoDoc->fp_template_size)
                    || ! empty($infoDoc->backup_number)
                    || ! empty($infoObj->enroll_data_array);

                // Avoid re-queuing IDs that the terminal already returned unless force=true
                if ($hasName || (! $forceRefresh && $hasPayload)) {
                    $resolvedUserIds[$iUid] = true;
                }
            }

            $queuedCount = 0;
            $seenUids = [];
            foreach ($idDocs as $doc) {
                $uid = trim((string) ($doc->user_id ?? ''));
                if (
                    $uid !== ''
                    && $uid !== '0'
                    && ! isset($seenUids[$uid])
                    && ! isset($resolvedUserIds[$uid])
                    && ! isset($activeOrRecentInfoIds[$uid])
                ) {
                    $seenUids[$uid] = true;
                    $offset = $queuedCommands + $queuedCount;
                    $queuedCount++;
                    $bulk->insert([
                        'trans_id' => (string) ($baseTransId + $offset),
                        'dev_id' => $devId,
                        'cmd_code' => 'GET_USER_INFO',
                        'cmd_param' => json_encode(['user_id' => $uid]),
                        'trans_status' => 'pending',
                        'trans_status_update_time' => now()->format('Y-m-d H:i:s'),
                        'result' => null,
                        'id' => $nextId + $offset,
                    ]);
                }
            }

            if ($bulk->count() > 0) {
                $manager->executeBulkWrite('biometric_db.command_request_pending', $bulk);
            }

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
            $fetchedInfoIds = [];
            foreach ($infoDocs as $rec) {
                $uid = trim((string) ($rec->user_id ?? ''));
                if (! $uid) {
                    continue;
                }
                $fetchedInfoIds[$uid] = true;
                $fetchedInfoIds[ltrim($uid, '0') ?: $uid] = true;
                $infoObj = is_string($rec->info ?? null) ? json_decode($rec->info) : ($rec->info ?? null);
                if (! isset($machineNames[$uid]) && ! empty($infoObj->user_name)) {
                    $machineNames[$uid] = (string) $infoObj->user_name;
                    $machineNames[ltrim($uid, '0') ?: $uid] = (string) $infoObj->user_name;
                }
            }

            $allDevices = Device::with('hostel')->get();
            $deviceBySerial = $allDevices->keyBy('device_serial');

            $punches = [];
            $missingInfoTargets = [];
            $syncedAttendanceKeys = [];
            foreach ($records as $record) {
                $bioId = trim((string) ($record->user_id ?? ''));
                $cleanId = ltrim($bioId, '0') ?: $bioId;

                $student = $studentsByBioId[$bioId] ?? ($studentsByBioId[$cleanId] ?? null);
                $machineName = $machineNames[$bioId] ?? ($machineNames[$cleanId] ?? null);

                $devSerial = $record->dev_id ?? 'RSS20241199684';
                $matchedDev = $deviceBySerial->get($devSerial) ?? $allDevices->first();

                if (
                    $bioId !== ''
                    && $bioId !== '0'
                    && ! isset($fetchedInfoIds[$bioId])
                    && ! isset($fetchedInfoIds[$cleanId])
                    && count($missingInfoTargets) < 10
                ) {
                    $missingInfoTargets[$devSerial.'|'.$bioId] = [
                        'dev_id' => $devSerial,
                        'user_id' => $bioId,
                    ];
                }

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
                        $attKey = $student->id.'|'.$attDate;

                        if (! isset($syncedAttendanceKeys[$attKey])) {
                            $syncedAttendanceKeys[$attKey] = true;
                            $existingAttendance = Attendance::query()
                                ->where('student_id', $student->id)
                                ->whereDate('attendance_date', $attDate)
                                ->first();

                            if (
                                ! $existingAttendance ||
                                $existingAttendance->punch_time === null ||
                                (string) $existingAttendance->punch_time > $punchAt->toTimeString()
                            ) {
                                $classification = ClockService::classifyPunchTime($punchAt->format('H:i:s'));

                                Attendance::updateOrCreate(
                                    [
                                        'student_id' => $student->id,
                                        'attendance_date' => $attDate,
                                    ],
                                    [
                                        'punch_time' => $punchAt->toTimeString(),
                                        'status' => $classification['status'],
                                        'is_defaulter' => $classification['is_defaulter'],
                                        'remarks' => $classification['is_defaulter']
                                            ? 'Biometric punch recorded after 10:00 PM IST (defaulter).'
                                            : ($classification['status'] === 'late'
                                                ? 'Biometric late punch (19:30 - 22:00 IST).'
                                                : 'Biometric machine punch'),
                                    ]
                                );
                            }
                        }
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
                    'isRegistered' => $student !== null,
                ];
            }

            if (! empty($missingInfoTargets)) {
                $this->queueMissingUserInfoCommands($manager, array_values($missingInfoTargets));
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

    /**
     * Extract a UTC Unix timestamp from a MongoDB document, preferring ObjectId time to avoid PHP ini timezone drift.
     */
    private function extractMongoTimestamp(object $doc): int
    {
        if (isset($doc->_id) && method_exists($doc->_id, 'getTimestamp')) {
            return (int) $doc->_id->getTimestamp();
        }

        if (! empty($doc->created_at)) {
            $parsed = strtotime((string) $doc->created_at);
            if ($parsed !== false) {
                return $parsed;
            }
        }

        return 0;
    }

    /**
     * Build a normalized machine user payload row for enrolledUsers().
     *
     * @param  array{name: ?string, privilege: string, hasFingerprint: bool, fingerprintCount: int, hasInfo: bool, timestamp: int, devId?: string}  $info
     * @return array<string, mixed>
     */
    private function buildMachineUserEntry(
        string $uid,
        string $devSerial,
        ?Student $student,
        array $info,
        mixed $matchedDev,
        int $sortTimestamp
    ): array {
        $hostelId = $student ? (string) $student->hostel_id : ($matchedDev ? (string) $matchedDev->hostel_id : '1');
        $hostelName = $student?->hostel?->name ?? ($matchedDev?->hostel?->name ?? 'Boys Hostel 1');
        $hostelCode = $student?->hostel?->code ?? ($matchedDev?->hostel?->code ?? 'BH1');

        $resolvedName = ($student && $student->user && ! empty(trim((string) $student->user->name)))
            ? trim($student->user->name)
            : $info['name'];

        $enrolledAt = $sortTimestamp > 0
            ? Carbon::createFromTimestamp($sortTimestamp, ClockService::TIMEZONE)
            : null;

        return [
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
            'enrolledDate' => $enrolledAt?->toDateString(),
            'infoFetchedAt' => $enrolledAt?->format('Y-m-d H:i:s'),
            'isRegistered' => ($student !== null),
            'studentId' => $student ? (string) $student->id : null,
            'enrollmentNo' => $student?->enrollment_no,
            'roomNumber' => $student?->room?->room_number,
            'bedNumber' => $student?->bed_number,
            '_sortTimestamp' => $sortTimestamp,
        ];
    }

    /**
     * Periodically queue GET_USER_ID_LIST (cooldown 20s) so newly enrolled machine users are discovered automatically.
     */
    private function queuePeriodicUserIdDiscovery(Manager $manager, string $devId): void
    {
        if (trim($devId) === '') {
            return;
        }

        try {
            $latestQuery = new Query(
                ['dev_id' => $devId, 'cmd_code' => 'GET_USER_ID_LIST'],
                ['sort' => ['_id' => -1], 'limit' => 1]
            );
            $latestDocs = iterator_to_array($manager->executeQuery('biometric_db.command_request_pending', $latestQuery));
            $latest = $latestDocs[0] ?? null;
            $nowTimestamp = now()->timestamp;

            if ($latest) {
                $status = strtolower((string) ($latest->trans_status ?? ''));
                $queuedAt = $this->extractMongoTimestamp($latest);
                if (
                    in_array($status, ['pending', 'running'], true)
                    || ($queuedAt > 0 && $queuedAt <= $nowTimestamp && ($nowTimestamp - $queuedAt) < 20)
                ) {
                    return;
                }
            }

            [$baseTransId, $nextId] = $this->nextSequentialCommandIds($manager);
            $bulk = new BulkWrite;
            $bulk->insert([
                'trans_id' => (string) $baseTransId,
                'dev_id' => $devId,
                'cmd_code' => 'GET_USER_ID_LIST',
                'cmd_param' => '{}',
                'trans_status' => 'pending',
                'trans_status_update_time' => now()->format('Y-m-d H:i:s'),
                'result' => null,
                'id' => $nextId,
            ]);
            $manager->executeBulkWrite('biometric_db.command_request_pending', $bulk);
        } catch (\Throwable $e) {
            \Log::warning('Failed periodic GET_USER_ID_LIST discovery: '.$e->getMessage());
        }
    }

    /**
     * Compute the next compact sequential trans_id and integer id for command_request_pending.
     *
     * @return array{0: int, 1: int}
     */
    private function nextSequentialCommandIds(Manager $manager): array
    {
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

        return [$maxTransId + 1, $maxId + 1];
    }

    /**
     * Queue GET_USER_INFO commands for machine users missing from user_info_result, with deduplication.
     *
     * @param  array<int, array{dev_id: string, user_id: string}>  $targets
     */
    private function queueMissingUserInfoCommands(Manager $manager, array $targets): void
    {
        if (empty($targets)) {
            return;
        }

        try {
            $devIds = array_values(array_unique(array_column($targets, 'dev_id')));
            $pendingQuery = new Query([
                'dev_id' => ['$in' => $devIds],
                'cmd_code' => 'GET_USER_INFO',
            ]);

            $nowTimestamp = now()->timestamp;
            $alreadyQueued = [];

            foreach ($manager->executeQuery('biometric_db.command_request_pending', $pendingQuery) as $pDoc) {
                $status = strtolower((string) ($pDoc->trans_status ?? ''));
                $queuedAt = $this->extractMongoTimestamp($pDoc);

                if (
                    ! in_array($status, ['pending', 'running'], true)
                    && ($queuedAt === 0 || $queuedAt > $nowTimestamp || ($nowTimestamp - $queuedAt) >= 30)
                ) {
                    continue;
                }

                $paramObj = is_string($pDoc->cmd_param ?? null) ? json_decode($pDoc->cmd_param) : ($pDoc->cmd_param ?? null);
                $pUid = trim((string) ($paramObj->user_id ?? ''));
                $pDev = trim((string) ($pDoc->dev_id ?? ''));
                if ($pDev !== '' && $pUid !== '') {
                    $alreadyQueued[$pDev.'|'.$pUid] = true;
                }
            }

            [$baseTransId, $nextId] = $this->nextSequentialCommandIds($manager);
            $bulk = new BulkWrite;
            $offset = 0;

            foreach ($targets as $target) {
                $devId = trim((string) ($target['dev_id'] ?? ''));
                $uid = trim((string) ($target['user_id'] ?? ''));
                if ($devId === '' || $uid === '' || isset($alreadyQueued[$devId.'|'.$uid])) {
                    continue;
                }

                $alreadyQueued[$devId.'|'.$uid] = true;
                $bulk->insert([
                    'trans_id' => (string) ($baseTransId + $offset),
                    'dev_id' => $devId,
                    'cmd_code' => 'GET_USER_INFO',
                    'cmd_param' => json_encode(['user_id' => $uid]),
                    'trans_status' => 'pending',
                    'trans_status_update_time' => now()->format('Y-m-d H:i:s'),
                    'result' => null,
                    'id' => $nextId + $offset,
                ]);
                $offset++;
            }

            if ($offset > 0) {
                $manager->executeBulkWrite('biometric_db.command_request_pending', $bulk);
            }
        } catch (\Throwable $e) {
            \Log::warning('Failed to auto-queue GET_USER_INFO: '.$e->getMessage());
        }
    }
}
