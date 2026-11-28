<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DeviceController extends Controller
{
    // Admin-only access
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Only Admin can manage biometric devices.',
            ], 403);
        }

        return null;
    }

    // Register device
    public function store(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'hostel_id' => [
                'required',
                'exists:hostels,id',
                'unique:devices,hostel_id',
            ],
            'device_name' => ['required', 'string', 'max:255'],
            'device_serial' => ['required', 'string', 'max:255', 'unique:devices,device_serial'],
            'device_status' => ['sometimes', 'required', Rule::in(['active', 'inactive'])],
            'last_sync' => ['nullable', 'date'],
        ]);

        $device = Device::create($data);

        app(AuditService::class)->log(
            'Device Registered',
            'Device',
            $device->id,
            'Registered biometric device '.$device->device_name.' for hostel ID '.$device->hostel_id,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Biometric device registered successfully.',
            'device' => $device->load('hostel'),
        ], 201);
    }

    // View all devices
    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $devices = Device::with('hostel')
            ->withCount('punches')
            ->latest()
            ->get();

        return response()->json([
            'devices' => $devices,
        ]);
    }

    // View one device
    public function show(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $device = Device::with('hostel')
            ->withCount('punches')
            ->findOrFail($id);

        return response()->json([
            'device' => $device,
        ]);
    }

    // Update device details
    public function update(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $device = Device::findOrFail($id);

        $data = $request->validate([
            'hostel_id' => [
                'sometimes',
                'required',
                'exists:hostels,id',
                Rule::unique('devices', 'hostel_id')->ignore($device->id),
            ],
            'device_name' => ['sometimes', 'required', 'string', 'max:255'],
            'device_serial' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('devices', 'device_serial')->ignore($device->id),
            ],
            'device_status' => [
                'sometimes',
                'required',
                Rule::in(['active', 'inactive']),
            ],
            'last_sync' => ['sometimes', 'nullable', 'date'],
        ]);

        $device->update($data);

        app(AuditService::class)->log(
            'Device Updated',
            'Device',
            $device->id,
            'Updated biometric device '.$device->device_name,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Device updated successfully.',
            'device' => $device->fresh()->load('hostel'),
        ]);
    }

    // Update device status
    public function updateStatus(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'device_status' => [
                'required',
                Rule::in(['active', 'inactive']),
            ],
        ]);

        $device = Device::findOrFail($id);

        $oldStatus = $device->device_status;

        $device->update([
            'device_status' => $data['device_status'],
        ]);

        app(AuditService::class)->log(
            'Device Status Updated',
            'Device',
            $device->id,
            'Device status changed from '.$oldStatus.' to '.$device->device_status,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Device status updated successfully.',
            'device' => $device,
        ]);
    }

    // Delete device
    public function destroy(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $device = Device::findOrFail($id);

        if ($device->punches()->exists()) {
            return response()->json([
                'message' => 'This device cannot be deleted because punch records are associated with it.',
            ], 422);
        }

        $deviceName = $device->device_name;
        $deviceId = $device->id;

        $device->delete();

        app(AuditService::class)->log(
            'Device Deleted',
            'Device',
            $deviceId,
            'Deleted biometric device '.$deviceName,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Biometric device deleted successfully.',
        ]);
    }
}
