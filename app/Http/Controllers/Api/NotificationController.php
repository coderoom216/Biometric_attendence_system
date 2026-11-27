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
        $user = $request->user();
        $role = $user->role?->name;

        if (! in_array($role, [
            'Admin',
            'Residential Warden',
            'Warden',
            'Chief Warden',
            'Director',
            'Caretaker',
            'Caretaker Operator',
        ], true)) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if ($user->isHostelScoped() && empty($user->hostel_id)) {
            return response()->json([
                'message' => "{$role} has no assigned hostel.",
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

        if ($user->isHostelScoped()) {
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
            'Notification attempt created through '.$notification->channel,
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
            'alert.student.hostel',
            'alert.alertTier',
        ]);

        if ($user->isHostelScoped()) {
            $query->whereHas('alert.student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        if ($studentId = $request->query('studentId')) {
            $query->whereHas('alert', fn ($q) => $q->where('student_id', $studentId));
        }

        if ($tier = $request->query('tier')) {
            $query->whereHas('alert', fn ($q) => $q->where('tier_id', (int) $tier));
        }

        if ($status = $request->query('status')) {
            $query->where('delivery_status', $status === 'delivered' ? 'sent' : $status);
        }

        if ($date = $request->query('date')) {
            $query->where(function ($q) use ($date) {
                $q->whereDate('sent_at', $date)
                    ->orWhereHas('alert', fn ($aq) => $aq->whereDate('triggered_at', $date));
            });
        }

        $logs = $query->latest('id')->get()->map(function (Notification $n): array {
            $student = $n->alert?->student;
            $hostel = $student?->hostel;
            $code = strtolower((string) ($hostel?->code ?? ''));
            $hostelId = match ($code) {
                'bh1' => 'h-shivalik',
                'gh' => 'h-mandakini',
                'bh2' => 'h-nilgiri',
                default => (string) ($hostel?->id ?? ''),
            };
            $rawStatus = strtolower((string) $n->delivery_status);
            $normalizedStatus = $rawStatus === 'sent' ? 'delivered' : ($rawStatus === 'pending' ? 'queued' : $rawStatus);
            $timestamp = $n->sent_at ?? $n->alert?->triggered_at ?? now();

            return [
                'id' => (string) $n->id,
                'date' => $timestamp->format('Y-m-d'),
                'studentId' => (string) ($student?->id ?? ''),
                'studentName' => $student?->user?->name ?? 'Unknown Student',
                'enrollmentNo' => $student?->enrollment_no ?? '',
                'hostelId' => $hostelId,
                'tier' => (int) ($n->alert?->tier_id ?? 1),
                'recipientRole' => $n->alert?->alertTier?->tier_name ?? 'staff',
                'recipientName' => $n->recipient,
                'recipientEmail' => $n->recipient,
                'channel' => strtolower((string) $n->channel),
                'status' => $normalizedStatus,
                'failureReason' => $n->error_message,
                'timestamp' => $timestamp->format('Y-m-d H:i:s'),
                'message' => $n->alert?->alert_type ?? 'Attendance alert notification',
                'retryCount' => 0,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'stats' => [
                'total' => $logs->count(),
                'delivered' => $logs->where('status', 'delivered')->count(),
                'queued' => $logs->where('status', 'queued')->count(),
                'failed' => $logs->where('status', 'failed')->count(),
            ],
            'hierarchy' => [
                'Residential Warden',
                'Warden',
                'Chief Warden',
                'Director',
                'Parents / Guardians',
                'Student',
            ],
            'logs' => $logs,
        ]);
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

        if ($user->isHostelScoped()) {
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
            'Notification delivery status changed to '.
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
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'notificationId' => ['required'],
            'overrideEmail' => ['nullable', 'email'],
        ]);

        $user = $request->user();
        $query = Notification::with('alert.student');
        if ($user->isHostelScoped()) {
            $query->whereHas('alert.student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $notification = $query->findOrFail($data['notificationId']);

        if (! empty($data['overrideEmail'])) {
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
