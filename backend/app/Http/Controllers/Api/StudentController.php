<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Models\Student;
use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Services\AuditService;


class StudentController extends Controller
{
    // Check Admin access
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        return null;
    }

    // Create Student Account and Profile
    public function store(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',

            'hostel_id' => 'required|exists:hostels,id',
            'room_id' => 'required|exists:rooms,id',

            'enrollment_no' => 'required|string|unique:students,enrollment_no',
            'course' => 'required|string|max:255',
            'biometric_id' => 'required|string|unique:students,biometric_id',
            'bed_number' => 'required|string|max:255',

           'parent_guardian_name' => 'sometimes|nullable|string|max:255',
            'parent_email' => 'sometimes|nullable|email',
        ]);

        // Check whether room belongs to selected hostel
        $room = Room::where('id', $data['room_id'])
            ->where('hostel_id', $data['hostel_id'])
            ->first();

        if (!$room) {
            return response()->json([
                'message' => 'Selected room does not belong to this hostel.'
            ], 422);
        }

        // Check room capacity
        if ($room->students()->count() >= $room->capacity) {
            return response()->json([
                'message' => 'Selected room is already full.'
            ], 422);
        }

        // Find Student role
        $studentRole = Role::where('name', 'Student')->first();

        if (!$studentRole) {
            return response()->json([
                'message' => 'Student role has not been configured.'
            ], 422);
        }

        // Create user and student profile together
        $student = DB::transaction(function () use ($data, $studentRole) {

            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'role_id' => $studentRole->id,
                'hostel_id' => $data['hostel_id'],
                'is_active' => true,
            ]);

             return response()->json([
            'message' => 'Student account created successfully.',
            'student' => $student->load('user', 'hostel', 'room'),
             ], 201);

            return Student::create([
                'user_id' => $user->id,
                'hostel_id' => $data['hostel_id'],
                'room_id' => $data['room_id'],
                'enrollment_no' => $data['enrollment_no'],
                'course' => $data['course'],
                'biometric_id' => $data['biometric_id'],
                'bed_number' => $data['bed_number'],
                'parent_guardian_name' => $data['parent_guardian_name'] ?? null,
                'parent_email' => $data['parent_email'] ?? null,
                'verification_status' => 'pending',
            ]);
        });
                $student = DB::transaction(function () use ($data, $studentRole) {

            // Existing User and Student creation code

        });

        // Audit Log
        app(AuditService::class)->log(
            'Student Created',
            'Student',
            $student->id,
            'Created student profile for enrollment number ' . $student->enrollment_no,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Student account created successfully.',
            'student' => $student->load('user', 'hostel', 'room'),
        ], 201);

        return response()->json([
            'message' => 'Student account created successfully.',
            'student' => $student->load('user', 'hostel', 'room'),
        ], 201);
    }

    // View all students
    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $students = Student::with('user', 'hostel', 'room')->get();

        return response()->json([
            'students' => $students
        ]);
    }

    // View student profile
    public function show(Request $request, $id)
    {
        $student = Student::with('user', 'hostel', 'room')
            ->findOrFail($id);

        $isAdmin = $request->user()->role?->name === 'Admin';
        $isOwner = $student->user_id === $request->user()->id;

        if (!$isAdmin && !$isOwner) {
            return response()->json([
                'message' => 'Unauthorized access.'
            ], 403);
        }

        return response()->json([
            'student' => $student
        ]);
    }

    // Update student details and room allocation
    public function update(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $student = Student::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => [
                'sometimes',
                'required',
                'email',
                Rule::unique('users', 'email')->ignore($student->user_id),
            ],
            'hostel_id' => 'sometimes|required|exists:hostels,id',
            'room_id' => 'sometimes|required|exists:rooms,id',
            'enrollment_no' => [
                'sometimes',
                'required',
                Rule::unique('students', 'enrollment_no')->ignore($student->id),
            ],
            'course' => 'sometimes|required|string|max:255',
            'biometric_id' => [
                'sometimes',
                'required',
                Rule::unique('students', 'biometric_id')->ignore($student->id),
            ],
            'bed_number' => 'sometimes|required|string|max:255',
            'parent_guardian_name' => 'nullable|string|max:255',
            'parent_email' => 'nullable|email',
            'verification_status' => 'sometimes|required|in:pending,verified,rejected',
        ]);

        $hostelId = $data['hostel_id'] ?? $student->hostel_id;
        $roomId = $data['room_id'] ?? $student->room_id;

        $room = Room::where('id', $roomId)
            ->where('hostel_id', $hostelId)
            ->first();

        if (!$room) {
            return response()->json([
                'message' => 'Selected room does not belong to this hostel.'
            ], 422);
        }

        // Check capacity when changing room
        if ($roomId != $student->room_id &&
            $room->students()->count() >= $room->capacity) {
            return response()->json([
                'message' => 'Selected room is already full.'
            ], 422);
        }

        DB::transaction(function () use ($data, $student, $hostelId, $roomId) {

            $studentData = $data;

unset($studentData['name'], $studentData['email']);

$student->update(array_merge($studentData, [
    'hostel_id' => $hostelId,
    'room_id' => $roomId,
]));

            $userData = [];

            if (isset($data['name'])) {
                $userData['name'] = $data['name'];
            }

            if (isset($data['email'])) {
                $userData['email'] = $data['email'];
            }

            if (isset($data['hostel_id'])) {
                $userData['hostel_id'] = $hostelId;
            }

            if (!empty($userData)) {
                $student->user()->update($userData);
            }
        });
                app(AuditService::class)->log(
            'Student Updated',
            'Student',
            $student->id,
            'Updated student profile for enrollment number ' . $student->enrollment_no,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Student details updated successfully.',
            'student' => $student->fresh()->load('user', 'hostel', 'room'),
        ]);
    }
}
