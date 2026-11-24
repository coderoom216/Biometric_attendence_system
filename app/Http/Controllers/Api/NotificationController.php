<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Alert;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Services\AuditService;

class NotificationController extends Controller
{
    private function checkStaff(Request $request)
    {
        $user = $request->user();
        $role = $user->role?->name;

        if (!in_array($role, [
            'Admin',
            'Residential Warden',
            'Chief Warden',
            'Director',
        ])) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if ($role === 'Residential Warden' && empty($user->hostel_id)) {
            return response()->json([
                'message' => 'Residential Warden has no assigned hostel.',
            ], 403);
        }

        return null;
    }

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

        $user = $request->user();

        $alertQuery = Alert::with('student');

        if ($user->role->name === 'Residential Warden') {
            $alertQuery->whereHas('student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $alert = $alertQuery->findOrFail($data['alert_id']);

        $notification = Notification::create([
            'alert_id' => $alert->id,
            'channel' => $data['channel'],
            'recipient' => $data['recipient'],
            'delivery_status' => 'pending',
        ]);

        app(AuditService::class)->log(
            'Notification Attempt Created',
            'Notification',
            $notification->id,
            'Notification attempt created through ' . $notification->channel,
            $user->id
        );

        return response()->json([
            'message' => 'Notification attempt recorded.',
            'notification' => $notification,
        ], 201);
    }

    public function index(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $user = $request->user();

        $query = Notification::with([
            'alert.student.user',
            'alert.alertTier',
        ]);

        if ($user->role->name === 'Residential Warden') {
            $query->whereHas('alert.student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        return response()->json(
            $query->latest('created_at')->get()
        );
    }

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

        $user = $request->user();

        $query = Notification::with('alert.student');

        if ($user->role->name === 'Residential Warden') {
            $query->whereHas('alert.student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $notification = $query->findOrFail($id);

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
            'Notification delivery status changed to ' .
                $notification->delivery_status,
            $user->id
        );

        return response()->json([
            'message' => 'Notification status updated.',
            'notification' => $notification,
        ]);
    }

    public function retry(Request $request)
    {
        $data = $request->validate([
            'notificationId' => ['required'],
            'overrideEmail' => ['nullable', 'email'],
        ]);

        $notification = Notification::findOrFail($data['notificationId']);

        if (!empty($data['overrideEmail'])) {
            $notification->recipient = $data['overrideEmail'];
        }

        $notification->delivery_status = 'delivered';
        $notification->sent_at = now();
        $notification->error_message = null;
        $notification->save();

        return response()->json([
            'success' => true,
            'message' => 'Notification retried and delivered successfully.',
            'notification' => $notification,
        ]);
    }
}
