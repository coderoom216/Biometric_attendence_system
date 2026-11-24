<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Violation;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\AuditService;

class ViolationController extends Controller
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

        if (
            $role === 'Residential Warden' &&
            empty($user->hostel_id)
        ) {
            return response()->json([
                'message' => 'Residential Warden has no assigned hostel.',
            ], 403);
        }

        return null;
    }

    // Create violation and automatically generate ticket
    public function store(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'student_id' => ['required', 'exists:students,id'],
            'violation_type' => ['required', 'string', 'max:255'],
            'violation_date' => ['required', 'date'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();

        $studentQuery = Student::query();

        if ($user->role->name === 'Residential Warden') {
            $studentQuery->where('hostel_id', $user->hostel_id);
        }

        $student = $studentQuery->findOrFail($data['student_id']);

        $result = DB::transaction(function () use ($data) {
            $violation = Violation::create($data);

            $ticket = Ticket::create([
                'violation_id' => $violation->id,
                'warning_status' => 'issued',
                'issue_date' => now()->toDateString(),
            ]);

            return [
                'violation' => $violation,
                'ticket' => $ticket,
            ];
        });

        app(AuditService::class)->log(
            'Violation Created',
            'Violation',
            $result['violation']->id,
            'Violation recorded and warning ticket generated for student ID ' .
                $result['violation']->student_id,
            $user->id
        );

        return response()->json([
            'message' => 'Violation recorded and warning ticket issued successfully.',
            'violation' => $result['violation'],
            'ticket' => $result['ticket'],
        ], 201);
    }

    // View all violations
    public function index(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $query = Violation::with('student.user', 'ticket');

        $user = $request->user();

        if ($user->role->name === 'Residential Warden') {
            $query->whereHas('student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        return response()->json([
            'violations' => $query->latest()->get(),
        ]);
    }

    // View one violation
    public function show(Request $request, $id)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $user = $request->user();

        $query = Violation::with(
            'student.user',
            'ticket.actions'
        );

        if ($user->role->name === 'Residential Warden') {
            $query->whereHas('student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $violation = $query->findOrFail($id);

        return response()->json([
            'violation' => $violation,
        ]);
    }
}
