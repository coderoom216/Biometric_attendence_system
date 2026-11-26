<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Leave;
use App\Models\Student;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LeaveController extends Controller
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

        if (
            $user->isHostelScoped() &&
            empty($user->hostel_id)
        ) {
            return response()->json([
                'message' => "{$role} has no assigned hostel.",
            ], 403);
        }

        return null;
    }

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
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['required', 'string', 'max:2000'],
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
            'Student applied for leave from '.
                $leave->start_date.' to '.$leave->end_date,
            $user->id
        );

        return response()->json([
            'message' => 'Leave request submitted successfully.',
            'leave' => $leave,
        ], 201);
    }

    // Staff views leave requests
    public function index(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $user = $request->user();

        $query = Leave::with(['student.user', 'student.hostel', 'student.room', 'approvedBy']);

        if ($user->isHostelScoped()) {
            $query->whereHas('student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $leaves = $query->latest('start_date')->get()->map(fn ($l) => [
            'id' => (string) $l->id,
            'studentId' => (string) $l->student_id,
            'studentName' => $l->student?->user?->name ?? 'Student',
            'enrollmentNo' => $l->student?->enrollment_no ?? '',
            'hostel' => $l->student?->hostel?->name ?? '',
            'roomNumber' => $l->student?->room?->room_number ?? '',
            'startDate' => $l->start_date?->toDateString() ?? $l->start_date,
            'endDate' => $l->end_date?->toDateString() ?? $l->end_date,
            'reason' => $l->reason,
            'gatePassNo' => $l->gate_pass_no,
            'approvalStatus' => $l->approval_status,
            'status' => $l->approval_status === 'approved' ? 'Approved' : ($l->approval_status === 'rejected' ? 'Rejected' : 'Pending'),
            'approvedBy' => $l->approvedBy?->name ?? 'Warden',
            'approvedAt' => $l->approved_at?->toIso8601String(),
            'notes' => $l->reason,
        ]);

        return response()->json([
            'success' => true,
            'total' => $leaves->count(),
            'leaves' => $leaves,
        ]);
    }

    // Warden directly enters approved leave
    public function enter(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'studentId' => ['required'],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            'reason' => ['required', 'string'],
            'gatePassNo' => ['nullable', 'string'],
            'parentConsentVerified' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        $student = Student::findOrFail($data['studentId']);
        $user = $request->user();

        if ($user->isHostelScoped() && (int) $student->hostel_id !== (int) $user->hostel_id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized hostel access.'], 403);
        }

        $gatePassNo = $data['gatePassNo'] ?? ('GP-'.strtoupper(Str::random(8)));
        $isCaretaker = $user->isCaretaker();

        $leave = Leave::create([
            'student_id' => $student->id,
            'approved_by' => $isCaretaker ? null : $user->id,
            'start_date' => $data['startDate'],
            'end_date' => $data['endDate'],
            'reason' => $data['reason'].(! empty($data['notes']) ? ' ('.$data['notes'].')' : ''),
            'gate_pass_no' => $gatePassNo,
            'approval_status' => $isCaretaker ? 'pending' : 'approved',
            'approved_at' => $isCaretaker ? null : now(),
        ]);

        app(AuditService::class)->log(
            $isCaretaker ? 'Leave Assigned by Caretaker' : 'Leave Entered by Warden',
            'Leave',
            $leave->id,
            ($isCaretaker ? 'Pending leave assigned for ' : 'Approved leave entered for ')
                .$student->enrollment_no.' from '.$leave->start_date.' to '.$leave->end_date,
            $user->id
        );

        return response()->json([
            'success' => true,
            'message' => $isCaretaker
                ? 'Leave assigned successfully and queued for Warden approval.'
                : 'Approved leave logged successfully.',
            'leave' => [
                'id' => (string) $leave->id,
                'studentId' => (string) $student->id,
                'studentName' => $student->user?->name ?? 'Student',
                'enrollmentNo' => $student->enrollment_no,
                'startDate' => $leave->start_date?->toDateString() ?? $leave->start_date,
                'endDate' => $leave->end_date?->toDateString() ?? $leave->end_date,
                'reason' => $leave->reason,
                'gatePassNo' => $leave->gate_pass_no,
                'status' => $isCaretaker ? 'Pending' : 'Approved',
                'approvalStatus' => $isCaretaker ? 'pending' : 'approved',
                'approvedBy' => $isCaretaker ? 'Pending Warden' : $user->name,
                'approvedAt' => $leave->approved_at?->toIso8601String(),
            ],
        ], 201);
    }

    // Staff approves or rejects leave
    public function updateStatus(Request $request, $id)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $user = $request->user();

        if ($user->isCaretaker()) {
            return response()->json([
                'success' => false,
                'message' => 'Caretakers cannot approve or reject leaves. Only Wardens can approve leave requests.',
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
            $user->isHostelScoped() &&
            (int) $leave->student->hostel_id !== (int) $user->hostel_id
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
