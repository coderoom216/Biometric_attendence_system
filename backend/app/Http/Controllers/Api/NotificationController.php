<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Notification;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    private function checkStaff(Request $request)
    {
        $role = $request->user()->role?->name;

        if (! in_array($role, [
            'Admin',
            'Residential Warden',
            'Chief Warden',
            'Director',
        ])) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        return null;
    }

    // Create notification attempt
    public function store(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'alert_id' => ['required', 'exists:alerts,id'],
            'channel' => ['required', Rule::in(['Email', 'SMS'])],
            'recipient' => ['required', 'string', 'max:255'],
        ]);

        $alert = Alert::with('student')
            ->findOrFail($data['alert_id']);

        $role = $request->user()->role?->name;

        if (
            $role === 'Residential Warden' &&
            $alert->student->hostel_id !== $request->user()->hostel_id
        ) {
            return response()->json([
                'message' => 'You cannot access alerts from another hostel.',
            ], 403);
        }

        $notification = Notification::create([
            'alert_id' => $data['alert_id'],
            'channel' => $data['channel'],
            'recipient' => $data['recipient'],
            'delivery_status' => 'pending',
        ]);
        app(AuditService::class)->log(
            'Notification Attempt Created',
            'Notification',
            $notification->id,
            'Notification attempt created through '.$notification->channel,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Notification attempt recorded.',
            'notification' => $notification,
        ], 201);
    }

    // View notification history
    public function index(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $query = Notification::with([
            'alert.student.user',
            'alert.alertTier',
        ])->latest('created_at');

        if ($request->user()->role?->name === 'Residential Warden') {
            $hostelId = $request->user()->hostel_id;

            $query->whereHas('alert.student', function ($q) use ($hostelId) {
                $q->where('hostel_id', $hostelId);
            });
        }

        return response()->json($query->get());
    }

    // Update delivery status
    public function updateStatus(Request $request, $id)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'delivery_status' => [
                'required',
                Rule::in(['sent', 'failed']),
            ],
            'error_message' => ['nullable', 'string'],
        ]);

        $notification = Notification::with('alert.student')
            ->findOrFail($id);

        if (
            $request->user()->role?->name === 'Residential Warden' &&
            $notification->alert->student->hostel_id !== $request->user()->hostel_id
        ) {
            return response()->json([
                'message' => 'You cannot update notifications from another hostel.',
            ], 403);
        }

        $notification->delivery_status = $data['delivery_status'];
        $notification->sent_at = $data['delivery_status'] === 'sent'
            ? now()
            : null;
        $notification->error_message = $data['delivery_status'] === 'failed'
            ? ($data['error_message'] ?? 'Notification delivery failed.')
            : null;

        $notification->save();
        app(AuditService::class)->log(
            'Notification Status Updated',
            'Notification',
            $notification->id,
            'Notification delivery status changed to '.$notification->delivery_status,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Notification status updated.',
            'notification' => $notification,
        ]);
    }
}
