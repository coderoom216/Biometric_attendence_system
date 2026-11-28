<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Services\AuditService;
use Illuminate\Http\Request;

class AlertController extends Controller
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

    public function index(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $query = Alert::with(['student.user', 'alertTier']);

        $user = $request->user();

        if ($user->isHostelScoped()) {
            $query->whereHas('student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        return response()->json([
            'alerts' => $query->latest('triggered_at')->get(),
        ]);
    }

    public function myAlerts(Request $request)
    {
        $user = $request->user();

        if ($user->role?->name !== 'Student') {
            return response()->json([
                'message' => 'Only students can view their alerts.',
            ], 403);
        }

        $student = $user->student;

        if (! $student) {
            return response()->json([
                'message' => 'Student profile not found.',
            ], 404);
        }

        return response()->json([
            'alerts' => Alert::where('student_id', $student->id)
                ->with('alertTier')
                ->latest('triggered_at')
                ->get(),
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'alert_status' => 'required|in:active,resolved',
        ]);

        $user = $request->user();

        $query = Alert::with('student');

        if ($user->isHostelScoped()) {
            $query->whereHas('student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $alert = $query->findOrFail($id);

        $alert->update([
            'alert_status' => $data['alert_status'],
        ]);

        app(AuditService::class)->log(
            'Alert Status Updated',
            'Alert',
            $alert->id,
            'Alert status changed to '.$data['alert_status'],
            $user->id
        );

        return response()->json([
            'message' => 'Alert status updated successfully.',
            'alert' => $alert->load('alertTier', 'student.user'),
        ]);
    }
}
