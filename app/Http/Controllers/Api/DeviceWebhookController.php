<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Punch;
use App\Models\Student;
use App\Services\DevicePayloadParser;
use DateTimeImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class DeviceWebhookController extends Controller
{
    public function handle(
        Request $request,
        DevicePayloadParser $parser
    ) {
        $requestCode = strtolower(
            (string) $request->header('request_code', '')
        );

        // Acknowledge requests not handled by this endpoint.
        if ($requestCode !== 'realtime_glog') {
            return $this->deviceResponse('OK');
        }

        try {
            $rawInput = $request->getContent();

            // Reject empty payloads.
            if ($rawInput === '') {
                return $this->deviceResponse('ERROR', 400);
            }

            // Handle gzip-compressed payloads.
            if (substr($rawInput, 0, 2) === "\x1f\x8b") {
                $inflated = gzdecode($rawInput);

                if ($inflated === false) {
                    return $this->deviceResponse('ERROR', 400);
                }

                $rawInput = $inflated;
            }

            // Extract JSON while ignoring trailing binary image data.
            $parsed = $parser->extractLeadingJson($rawInput);

            // Image continuation packets may contain no JSON.
            if ($parsed === null) {
                if (strpos($rawInput, '{') === false) {
                    return $this->deviceResponse('OK');
                }

                // JSON started but could not be parsed.
                return $this->deviceResponse('ERROR', 400);
            }

            $data = $parsed['data'];

            // Validate required punch fields.
            if (! $parser->validatePunch($data)) {
                return $this->deviceResponse('ERROR', 422);
            }

            $deviceId = trim(
                (string) $request->header('dev_id', '')
            );

            $biometricId = trim(
                (string) $data['user_id']
            );

            if ($deviceId === '' || $biometricId === '') {
                return $this->deviceResponse('ERROR', 422);
            }

            // Find the registered active biometric device.
            $device = Device::where(
                'device_serial',
                $deviceId
            )
                ->where('device_status', 'active')
                ->first();

            if (! $device) {
                Log::warning('Unknown or inactive biometric device.', [
                    'dev_id' => $deviceId,
                ]);

                return $this->deviceResponse('ERROR', 403);
            }

            // Match SDK user_id with students.biometric_id.
            $student = Student::where(
                'biometric_id',
                $biometricId
            )->first();

            if (! $student) {
                Log::warning('Biometric student ID not found.', [
                    'biometric_id' => $biometricId,
                    'device_id' => $device->id,
                ]);

                return $this->deviceResponse('ERROR', 404);
            }

            // Verify that the student belongs to this device's hostel.
            if ((int) $student->hostel_id !== (int) $device->hostel_id) {
                Log::warning('Biometric hostel mismatch.', [
                    'student_id' => $student->id,
                    'device_id' => $device->id,
                ]);

                return $this->deviceResponse('ERROR', 403);
            }

            // Normalize the SDK punch timestamp.
            $punchedAt = $this->normalizeDeviceDateTime(
                $data['io_time']
            );

            if ($punchedAt === null) {
                return $this->deviceResponse('ERROR', 422);
            }

            // Prevent duplicate punch records.
            $duplicate = Punch::where('student_id', $student->id)
                ->where('device_id', $device->id)
                ->where('punched_at', $punchedAt)
                ->exists();

            if ($duplicate) {
                return $this->deviceResponse('OK');
            }

            // Store the punch record.
            Punch::create([
                'student_id' => $student->id,
                'device_id' => $device->id,
                'punched_at' => $punchedAt,
                'synced_at' => now(),
            ]);

            // Update the device's last successful sync time.
            $device->update([
                'last_sync' => now(),
            ]);

            Log::info('Biometric punch received successfully.', [
                'student_id' => $student->id,
                'device_id' => $device->id,
                'punched_at' => $punchedAt,
            ]);

            return $this->deviceResponse('OK');

        } catch (Throwable $e) {
            Log::error('Biometric webhook processing failed.', [
                'error' => $e->getMessage(),
            ]);

            return $this->deviceResponse('ERROR', 500);
        }
    }

    /**
     * Normalize SDK timestamps.
     */
    private function normalizeDeviceDateTime($value): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        // Format: YYYYMMDDHHMMSS
        if (preg_match('/^\d{14}$/', $value)) {
            $date = DateTimeImmutable::createFromFormat(
                '!YmdHis',
                $value
            );

            return $date !== false &&
                $date->format('YmdHis') === $value
                    ? $date->format('Y-m-d H:i:s')
                    : null;
        }

        // Format: YYYYMMDD
        if (preg_match('/^\d{8}$/', $value)) {
            $date = DateTimeImmutable::createFromFormat(
                '!Ymd',
                $value
            );

            return $date !== false &&
                $date->format('Ymd') === $value
                    ? $date->format('Y-m-d 00:00:00')
                    : null;
        }

        // Unix timestamp.
        if (ctype_digit($value) && strlen($value) <= 11) {
            return date('Y-m-d H:i:s', (int) $value);
        }

        // Other supported date formats.
        try {
            return (new DateTimeImmutable($value))
                ->format('Y-m-d H:i:s');
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * Send the response expected by the biometric SDK.
     */
    private function deviceResponse(
        string $status,
        int $httpStatus = 200
    ) {
        return response('', $httpStatus, [
            'Content-Type' => 'application/octet-stream',
            'response_code' => $status,
            'Content-Length' => '0',
        ]);
    }
}
