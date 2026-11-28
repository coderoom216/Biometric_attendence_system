<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Ticket;
use App\Models\Violation;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ViolationController extends Controller
{
    // Check staff access
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

    // Create violation and automatically generate ticket
    public function store(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
            'violation_type' => 'required|string|max:255',
            'violation_date' => 'required|date',
            'description' => 'nullable|string|max:2000',
        ]);

        $student = Student::findOrFail($data['student_id']);
        $user = $request->user();

        // Residential Warden can manage only assigned hostel
        if (
            $user->role->name === 'Residential Warden' &&
            $student->hostel_id != $user->hostel_id
        ) {
            return response()->json([
                'message' => 'You cannot create violations for another hostel.',
            ], 403);
        }

        // Create violation and ticket together
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

        // Audit log outside transaction
        app(AuditService::class)->log(
            'Violation Created',
            'Violation',
            $result['violation']->id,
            'Violation recorded and warning ticket generated for student ID '.$result['violation']->student_id,
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

        $violation = Violation::with(
            'student.user',
            'ticket.actions'
        )->findOrFail($id);

        $user = $request->user();

        if (
            $user->role->name === 'Residential Warden' &&
            $violation->student->hostel_id != $user->hostel_id
        ) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        return response()->json([
            'violation' => $violation,
        ]);
    }
}
