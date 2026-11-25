<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Leave;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LeaveController extends Controller
{
    // Student applies for leave
    public function store(Request $request)
    {
        $user = $request->user();

        if ($user->role?->name !== 'Student') {
            return response()->json([
                'message' => 'Only students can apply for leave.',
            ], 403);
        }

        $student = $user->student;

        if (! $student) {
            return response()->json([
                'message' => 'Student profile not found.',
            ], 404);
        }

        $data = $request->validate([
            'start_date' => 'required|date|after_or_equal:today',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'required|string|max:2000',
        ]);

        $leave = Leave::create([
            'student_id' => $student->id,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'reason' => $data['reason'],
            'gate_pass_no' => 'GP-'.strtoupper(Str::random(10)),
            'approval_status' => 'pending',
        ]);
        app(AuditService::class)->log(
            'Leave Applied',
            'Leave',
            $leave->id,
            'Student applied for leave from '.$leave->start_date.' to '.$leave->end_date,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Leave request submitted successfully.',
            'leave' => $leave,
        ], 201);
    }

    // Warden views leave requests of assigned hostel
    public function index(Request $request)
    {
        $user = $request->user();

        if (! in_array($user->role?->name, [
            'Residential Warden',
            'Chief Warden',
            'Director',
            'Admin',
        ])) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        $query = Leave::with('student.user', 'approvedBy');

        if ($user->role->name === 'Residential Warden') {
            $query->whereHas('student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        return response()->json([
            'leaves' => $query->latest()->get(),
        ]);
    }

    // Warden approves or rejects leave
    public function updateStatus(Request $request, $id)
    {
        $user = $request->user();

        if (! in_array($user->role?->name, [
            'Residential Warden',
            'Chief Warden',
            'Director',
            'Admin',
        ])) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        $data = $request->validate([
            'approval_status' => [
                'required',
                Rule::in(['approved', 'rejected']),
            ],
        ]);

        $leave = Leave::with('student')->findOrFail($id);

        if (
            $user->role->name === 'Residential Warden' &&
            $leave->student->hostel_id != $user->hostel_id
        ) {
            return response()->json([
                'message' => 'You cannot manage leaves of another hostel.',
            ], 403);
        }

        if ($leave->approval_status !== 'pending') {
            return response()->json([
                'message' => 'This leave request has already been processed.',
            ], 422);
        }

        $leave->update([
            'approval_status' => $data['approval_status'],
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);
        app(AuditService::class)->log(
            $data['approval_status'] === 'approved'
                ? 'Leave Approved'
                : 'Leave Rejected',
            'Leave',
            $leave->id,
            'Leave request '.$data['approval_status'],
            $user->id
        );

        return response()->json([
            'message' => 'Leave request status updated successfully.',
            'leave' => $leave->fresh()->load('student.user', 'approvedBy'),
        ]);
    }

    // Student views own leave history
    public function myLeaves(Request $request)
    {
        $user = $request->user();

        if ($user->role?->name !== 'Student') {
            return response()->json([
                'message' => 'Only students can view their leave history.',
            ], 403);
        }

        $student = $user->student;

        if (! $student) {
            return response()->json([
                'message' => 'Student profile not found.',
            ], 404);
        }

        return response()->json([
            'leaves' => Leave::where('student_id', $student->id)
                ->latest()
                ->get(),
        ]);
    }
}
