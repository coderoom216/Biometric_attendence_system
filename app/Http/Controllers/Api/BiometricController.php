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
}
