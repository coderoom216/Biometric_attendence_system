<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Leave;
use App\Models\Student;
use App\Services\AuditService;
use App\Services\ClockService;
use App\Services\DefaulterEvaluationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LeaveController extends Controller
{
    private function formatLeaveResponse(Leave $leave): array
    {
        $leave->loadMissing(['student.user', 'student.hostel', 'student.room', 'approvedBy']);

        $statusLabel = $leave->approval_status === 'approved'
            ? 'Approved'
            : ($leave->approval_status === 'rejected' ? 'Rejected' : 'Pending');

        $approverName = $leave->approved_by
            ? ($leave->approvedBy?->name ?? 'Warden')
            : 'Pending Warden';

        $startStr = $leave->start_date?->toDateString() ?? (string) $leave->start_date;
        $endStr = $leave->end_date?->toDateString() ?? (string) $leave->end_date;
        $daysCount = 1;
        try {
            $s = Carbon::createFromFormat('Y-m-d', substr($startStr, 0, 10), ClockService::TIMEZONE)->startOfDay();
            $e = Carbon::createFromFormat('Y-m-d', substr($endStr, 0, 10), ClockService::TIMEZONE)->startOfDay();
            $daysCount = max(1, (int) $s->diffInDays($e) + 1);
        } catch (\Throwable) {
        }

        return [
            'id' => (string) $leave->id,
            'studentId' => (string) $leave->student_id,
            'studentName' => $leave->student?->user?->name ?? 'Student',
            'enrollmentNo' => $leave->student?->enrollment_no ?? '',
            'hostelId' => (string) ($leave->student?->hostel_id ?? ''),
            'hostel' => $leave->student?->hostel?->name ?? '',
            'hostelCode' => $leave->student?->hostel?->code ?? '',
            'block' => $leave->student?->hostel?->code ?? ($leave->student?->hostel?->name ?? 'Hostel'),
            'roomNumber' => $leave->student?->room?->room_number ?? '',
            'startDate' => $startStr,
            'endDate' => $endStr,
            'daysCount' => $daysCount,
            'reason' => $leave->reason,
            'gatePassNo' => $leave->gate_pass_no,
            'parentConsentVerified' => true,
            'approvalStatus' => $leave->approval_status,
            'status' => $statusLabel,
            'approvedBy' => $approverName,
            'residentialWardenName' => $approverName,
            'enteredByResidentialWardenId' => (string) ($leave->approved_by ?? ''),
            'approvedAt' => $leave->approved_at?->toIso8601String(),
            'createdAt' => $leave->created_at?->toIso8601String() ?? '',
            'notes' => $leave->reason,
        ];
    }

    private function syncApprovedLeaveAttendance(Leave $leave, int $staffUserId): void
    {
        if ($leave->approval_status !== 'approved') {
            return;
        }

        $startStr = $leave->start_date instanceof Carbon
            ? $leave->start_date->toDateString()
            : substr((string) $leave->start_date, 0, 10);
        $endStr = $leave->end_date instanceof Carbon
            ? $leave->end_date->toDateString()
            : substr((string) $leave->end_date, 0, 10);

        $cursor = Carbon::createFromFormat('Y-m-d', $startStr, ClockService::TIMEZONE)->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $endStr, ClockService::TIMEZONE)->startOfDay();
        $maxEnd = $cursor->copy()->addDays(90);
        if ($end->gt($maxEnd)) {
            $end = $maxEnd;
        }

        for (; $cursor->lte($end); $cursor->addDay()) {
            $dateStr = $cursor->toDateString();
            $existing = Attendance::query()
                ->where('student_id', $leave->student_id)
                ->whereDate('attendance_date', $dateStr)
                ->first();

            $payload = [
                'marked_by' => $staffUserId,
                'status' => 'approved_leave',
                'is_defaulter' => false,
                'remarks' => 'Approved leave (Gate Pass: '.$leave->gate_pass_no.').',
            ];

            if ($existing) {
                $existing->update($payload);
            } else {
                Attendance::create(array_merge([
                    'student_id' => $leave->student_id,
                    'attendance_date' => $dateStr,
                ], $payload));
            }
        }
    }

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
                'success' => false,
                'message' => 'Only students can apply for leave.',
            ], 403);
        }

        $student = $user->student;

        if (! $student) {
            return response()->json([
                'success' => false,
                'message' => 'Student profile not found.',
            ], 404);
        }

        if (! $request->has('start_date') && $request->has('startDate')) {
            $request->merge(['start_date' => $request->input('startDate')]);
        }
        if (! $request->has('end_date') && $request->has('endDate')) {
            $request->merge(['end_date' => $request->input('endDate')]);
        }

        $todayIst = app(ClockService::class)->current()->toDateString();

        $data = $request->validate([
            'start_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$todayIst],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
        ]);

        $hasDuplicateOrOverlap = Leave::query()
            ->where('student_id', $student->id)
            ->whereIn('approval_status', ['pending', 'approved'])
            ->whereDate('start_date', '<=', $data['end_date'])
            ->whereDate('end_date', '>=', $data['start_date'])
            ->exists();

        if ($hasDuplicateOrOverlap) {
            return response()->json([
                'success' => false,
                'message' => 'You already have a pending or approved leave application covering these dates.',
            ], 422);
        }

        $leave = Leave::create([
            'student_id' => $student->id,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'reason' => trim($data['reason']),
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
            'success' => true,
            'message' => 'Leave application submitted successfully (Pending Warden approval).',
            'leave' => $this->formatLeaveResponse($leave),
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

        $leaves = $query->latest('start_date')
            ->latest('id')
            ->get()
            ->map(fn (Leave $leave) => $this->formatLeaveResponse($leave));

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

        if (! $isCaretaker) {
            $this->syncApprovedLeaveAttendance($leave, $user->id);
        }

        return response()->json([
            'success' => true,
            'message' => $isCaretaker
                ? 'Leave assigned successfully and queued for Warden approval.'
                : 'Approved leave logged successfully.',
            'leave' => $this->formatLeaveResponse($leave),
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

        if (! $request->has('approval_status') && $request->has('status')) {
            $request->merge([
                'approval_status' => strtolower((string) $request->input('status')),
            ]);
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
                'success' => false,
                'message' => 'You cannot manage leaves of another hostel.',
            ], 403);
        }

        if ($leave->approval_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This leave request has already been processed.',
            ], 422);
        }

        $leave->update([
            'approval_status' => $data['approval_status'],
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        if ($data['approval_status'] === 'approved') {
            $this->syncApprovedLeaveAttendance($leave, $user->id);
        }

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
            'success' => true,
            'message' => 'Leave request status updated successfully.',
            'leave' => $this->formatLeaveResponse($leave->fresh()),
        ]);
    }

    // Warden/Admin updates an existing leave (e.g. dates, gate pass, reason)
    public function update(Request $request, $id)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $user = $request->user();

        if ($user->isCaretaker()) {
            return response()->json([
                'success' => false,
                'message' => 'Caretakers cannot edit leaves. Only Wardens can edit leave records.',
            ], 403);
        }

        $data = $request->validate([
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            'reason' => ['required', 'string', 'max:2000'],
            'gatePassNo' => ['nullable', 'string', 'max:100'],
            'approvalStatus' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
        ]);

        $leave = Leave::with('student')->findOrFail($id);

        if (
            $user->isHostelScoped() &&
            (int) $leave->student->hostel_id !== (int) $user->hostel_id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot edit leaves of another hostel.',
            ], 403);
        }

        $oldStartStr = $leave->start_date instanceof Carbon
            ? $leave->start_date->toDateString()
            : substr((string) $leave->start_date, 0, 10);
        $oldEndStr = $leave->end_date instanceof Carbon
            ? $leave->end_date->toDateString()
            : substr((string) $leave->end_date, 0, 10);

        $newApprovalStatus = $data['approvalStatus'] ?? $leave->approval_status;

        $leave->update([
            'start_date' => $data['startDate'],
            'end_date' => $data['endDate'],
            'reason' => $data['reason'],
            'gate_pass_no' => ! empty($data['gatePassNo']) ? $data['gatePassNo'] : $leave->gate_pass_no,
            'approval_status' => $newApprovalStatus,
            'approved_by' => $newApprovalStatus === 'pending' ? null : ($leave->approved_by ?? $user->id),
            'approved_at' => $newApprovalStatus === 'pending' ? null : ($leave->approved_at ?? now()),
        ]);

        $freshLeave = $leave->fresh();
        $newStartStr = $freshLeave->start_date instanceof Carbon
            ? $freshLeave->start_date->toDateString()
            : substr((string) $freshLeave->start_date, 0, 10);
        $newEndStr = $freshLeave->end_date instanceof Carbon
            ? $freshLeave->end_date->toDateString()
            : substr((string) $freshLeave->end_date, 0, 10);

        $today = app(ClockService::class)->current()->toDateString();
        $oldCursor = Carbon::createFromFormat('Y-m-d', $oldStartStr, ClockService::TIMEZONE)->startOfDay();
        $oldEnd = Carbon::createFromFormat('Y-m-d', $oldEndStr, ClockService::TIMEZONE)->startOfDay();
        $maxOldEnd = $oldCursor->copy()->addDays(90);
        if ($oldEnd->gt($maxOldEnd)) {
            $oldEnd = $maxOldEnd;
        }
        $evalService = app(DefaulterEvaluationService::class);

        for (; $oldCursor->lte($oldEnd); $oldCursor->addDay()) {
            $dStr = $oldCursor->toDateString();
            $stillCovered = $newApprovalStatus === 'approved' && $dStr >= $newStartStr && $dStr <= $newEndStr;
            if ($stillCovered) {
                continue;
            }

            $stillHasOtherApproved = Leave::query()
                ->where('student_id', $freshLeave->student_id)
                ->where('id', '!=', $freshLeave->id)
                ->where('approval_status', 'approved')
                ->whereDate('start_date', '<=', $dStr)
                ->whereDate('end_date', '>=', $dStr)
                ->exists();

            if (! $stillHasOtherApproved) {
                $staleAttendance = Attendance::query()
                    ->where('student_id', $freshLeave->student_id)
                    ->whereDate('attendance_date', $dStr)
                    ->where('status', 'approved_leave')
                    ->first();

                if ($staleAttendance) {
                    if ($staleAttendance->punch_time) {
                        $cls = ClockService::classifyPunchTime($staleAttendance->punch_time);
                        $staleAttendance->update([
                            'status' => $cls['status'],
                            'is_defaulter' => $cls['is_defaulter'],
                            'remarks' => 'Restored after leave dates updated.',
                        ]);
                    } else {
                        $staleAttendance->delete();
                        if ($dStr <= $today) {
                            $evalService->ensureEvaluatedForDate($dStr);
                        }
                    }
                }
            }
        }

        if ($newApprovalStatus === 'approved') {
            $this->syncApprovedLeaveAttendance($freshLeave, $user->id);
        }

        app(AuditService::class)->log(
            'Leave Updated',
            'Leave',
            $freshLeave->id,
            'Updated leave dates to '.$newStartStr.'..'.$newEndStr.' ('.$newApprovalStatus.')',
            $user->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Leave updated successfully.',
            'leave' => $this->formatLeaveResponse($freshLeave),
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

        $leaves = Leave::with(['student.user', 'student.hostel', 'student.room', 'approvedBy'])
            ->where('student_id', $student->id)
            ->latest('start_date')
            ->latest('id')
            ->get()
            ->map(fn (Leave $leave) => $this->formatLeaveResponse($leave));

        return response()->json([
            'success' => true,
            'leaves' => $leaves,
        ]);
    }
}
