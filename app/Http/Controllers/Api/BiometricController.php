<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Punch;
use App\Models\Student;
use App\Models\Notification;
use App\Services\ClockService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BiometricController extends Controller
{
    public function __construct(
        private ClockService $clockService
    ) {
    }

    public function devices(Request $request)
    {
        $devices = Device::with('hostel')->get()->map(function ($device) {
            return [
                'id' => (string) $device->id,
                'deviceName' => $device->device_name,
                'deviceSerial' => $device->device_serial,
                'hostelId' => (string) $device->hostel_id,
                'hostelName' => $device->hostel?->name ?? 'Unknown Hostel',
                'status' => $device->device_status,
                'ipAddress' => '192.168.1.' . (100 + $device->id),
                'lastSync' => $device->last_sync?->toIso8601String(),
                'firmware' => 'v3.2.1-thdc',
            ];
        });

        return response()->json([
            'success' => true,
            'authorizedAdministrator' => 'Mr. Mehra (Computer Science Dept)',
            'devices' => $devices,
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

        if (!$device) {
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

                if (!$student) {
                    $unrecognized++;
                    continue;
                }

                $punchTime = $punchItem['punchTimestamp'] ?? ($current->toDateString() . ' ' . ($punchItem['punchTime'] ?? $current->format('H:i:s')));
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

        $staleDevices = $devices->filter(fn ($d) => !$d->last_sync || $d->last_sync < $staleThreshold)->values();
        $syncedDevices = $totalDevices - $staleDevices->count();

        $missingParentEmails = Student::whereNull('parent_email')
            ->orWhere('parent_email', '')
            ->with('hostel', 'room')
            ->get()
            ->map(fn ($s) => [
                'id' => (string) $s->id,
                'name' => $s->user?->name ?? 'Student ' . $s->enrollment_no,
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
        try {
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new \MongoDB\Driver\Manager($mongoUri);

            $idQuery = new \MongoDB\Driver\Query([], ['sort' => ['user_id' => 1]]);
            $idDocs = iterator_to_array($manager->executeQuery('biometric_db.get_user_id', $idQuery));

            $infoQuery = new \MongoDB\Driver\Query([], ['sort' => ['created_at' => -1]]);
            $infoDocs = iterator_to_array($manager->executeQuery('biometric_db.user_info_result', $infoQuery));

            $infoMap = [];
            foreach ($infoDocs as $doc) {
                $uid = trim((string) ($doc->user_id ?? ''));
                if (!$uid) continue;
                $infoObj = is_string($doc->info ?? null) ? json_decode($doc->info) : ($doc->info ?? null);
                if (!isset($infoMap[$uid])) {
                    $infoMap[$uid] = [
                        'name' => $infoObj->user_name ?? ($doc->name ?? null),
                        'privilege' => $infoObj->privilege ?? ($doc->privilege ?? 'User'),
                        'hasFingerprint' => !empty($doc->backup_number) || !empty($doc->raw_size) || !empty($doc->fp_template_size),
                        'fingerprintCount' => !empty($doc->backup_number) || !empty($doc->raw_size) ? 1 : 0,
                        'hasInfo' => true,
                    ];
                }
            }

            $users = [];
            foreach ($idDocs as $doc) {
                $uid = trim((string) ($doc->user_id ?? ''));
                if (!$uid || $uid === '0') continue;
                $info = $infoMap[$uid] ?? [
                    'name' => null,
                    'privilege' => 'User',
                    'hasFingerprint' => false,
                    'fingerprintCount' => 0,
                    'hasInfo' => false,
                ];

                $users[] = [
                    'userId' => $uid,
                    'deviceSerial' => $doc->dev_id ?? 'RSS20241199684',
                    'name' => $info['name'],
                    'privilege' => $info['privilege'],
                    'fingerprintEnrolled' => $info['hasFingerprint'],
                    'fingerprintCount' => $info['fingerprintCount'],
                    'hasInfo' => $info['hasInfo'],
                ];
            }

            return response()->json([
                'success' => true,
                'count' => count($users),
                'users' => $users,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'MongoDB connection failed: ' . $e->getMessage(),
            ], 503);
        }
    }

    public function triggerUserFetch(Request $request)
    {
        try {
            $devId = $request->input('deviceId', 'RSS20241199684');
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new \MongoDB\Driver\Manager($mongoUri);

            $bulk = new \MongoDB\Driver\BulkWrite();
            $transId = (string) rand(10000, 99999);
            $nextId = (int) (round(microtime(true) * 1000) % 100000000);

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

            $idQuery = new \MongoDB\Driver\Query(['dev_id' => $devId]);
            $idDocs = iterator_to_array($manager->executeQuery('biometric_db.get_user_id', $idQuery));

            $infoQuery = new \MongoDB\Driver\Query(['dev_id' => $devId]);
            $infoDocs = iterator_to_array($manager->executeQuery('biometric_db.user_info_result', $infoQuery));
            $confirmed = [];
            foreach ($infoDocs as $inf) {
                if (!empty($inf->raw_size) || !empty($inf->backup_number)) {
                    $confirmed[(string) $inf->user_id] = true;
                }
            }

            $queuedCount = 0;
            foreach ($idDocs as $doc) {
                $uid = trim((string) ($doc->user_id ?? ''));
                if ($uid && $uid !== '0' && empty($confirmed[$uid])) {
                    $queuedCount++;
                    $bulk->insert([
                        'trans_id' => (string) rand(10000, 99999),
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
                'message' => 'Failed to queue sync command: ' . $e->getMessage(),
            ], 503);
        }
    }

    public function live(Request $request)
    {
        try {
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new \MongoDB\Driver\Manager($mongoUri);

            $glogQuery = new \MongoDB\Driver\Query([], ['sort' => ['id' => -1], 'limit' => 100]);
            $records = iterator_to_array($manager->executeQuery('biometric_db.glog_data', $glogQuery));

            $students = Student::with('user', 'hostel')->get();
            $studentsByBioId = [];
            foreach ($students as $s) {
                $raw = trim((string) $s->biometric_id);
                $clean = ltrim($raw, '0') ?: $raw;
                $studentsByBioId[$raw] = $s;
                $studentsByBioId[$clean] = $s;
            }

            $infoQuery = new \MongoDB\Driver\Query([], ['sort' => ['created_at' => -1]]);
            $infoDocs = iterator_to_array($manager->executeQuery('biometric_db.user_info_result', $infoQuery));
            $machineNames = [];
            foreach ($infoDocs as $rec) {
                $uid = trim((string) ($rec->user_id ?? ''));
                if (!$uid) continue;
                $infoObj = is_string($rec->info ?? null) ? json_decode($rec->info) : ($rec->info ?? null);
                if (!isset($machineNames[$uid]) && !empty($infoObj->user_name)) {
                    $machineNames[$uid] = (string) $infoObj->user_name;
                    $machineNames[ltrim($uid, '0') ?: $uid] = (string) $infoObj->user_name;
                }
            }

            $device = Device::first();

            $punches = [];
            foreach ($records as $record) {
                $bioId = trim((string) ($record->user_id ?? ''));
                $cleanId = ltrim($bioId, '0') ?: $bioId;

                $student = $studentsByBioId[$bioId] ?? ($studentsByBioId[$cleanId] ?? null);
                $machineName = $machineNames[$bioId] ?? ($machineNames[$cleanId] ?? null);

                $studentName = $student?->user?->name ?? ($machineName ?? null);
                $enrollmentNo = $student?->enrollment_no ?? ($machineName ? 'BIO-' . str_pad($cleanId, 4, '0', STR_PAD_LEFT) : null);
                $isRecognized = ($student !== null || $machineName !== null);

                if ($student && !empty($record->io_time)) {
                    try {
                        $punchAt = Carbon::parse($record->io_time, ClockService::TIMEZONE);
                        Punch::firstOrCreate(
                            [
                                'student_id' => $student->id,
                                'punched_at' => $punchAt,
                            ],
                            [
                                'device_id' => $device?->id ?? 1,
                                'synced_at' => now(),
                            ]
                        );
                    } catch (\Throwable) {}
                }

                $ioMode = (string) ($record->io_mode ?? '');
                $direction = ($ioMode === '1') ? 'IN' : (($ioMode === '0') ? 'OUT' : 'UNKNOWN');

                $punches[] = [
                    'id' => (string) ($record->id ?? ($record->_id ?? uniqid())),
                    'biometricId' => $bioId,
                    'studentName' => $studentName,
                    'enrollmentNo' => $enrollmentNo,
                    'hostelId' => $student ? (string) $student->hostel_id : '1',
                    'deviceSerial' => $record->dev_id ?? 'RSS20241199684',
                    'verifyMode' => $record->verify_mode ?? null,
                    'ioMode' => $record->io_mode ?? null,
                    'direction' => $direction,
                    'punchTime' => $record->io_time ?? null,
                    'recognized' => $isRecognized,
                ];
            }

            return response()->json([
                'success' => true,
                'mongo' => ['connected' => true, 'database' => 'biometric_db', 'collection' => 'glog_data'],
                'total' => count($punches),
                'punches' => $punches,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to read biometric records: ' . $e->getMessage(),
            ], 503);
        }
    }
}
