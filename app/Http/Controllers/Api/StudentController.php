<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Room;
use App\Models\Student;
use App\Models\Ticket;
use App\Models\Token;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use MongoDB\Driver\BulkWrite;
use MongoDB\Driver\Manager;

class StudentController extends Controller
{
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        return null;
    }

    private function checkStudentViewAccess(Request $request)
    {
        $role = $request->user()->role?->name;

        $allowedRoles = [
            'Admin',
            'Residential Warden',
            'Warden',
            'Chief Warden',
            'Director',
            'Caretaker Operator',
        ];

        if (! in_array($role, $allowedRoles, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if (in_array($role, ['Residential Warden', 'Warden'], true) && ! $request->user()->hostel_id) {
            return response()->json([
                'success' => false,
                'message' => 'No hostel is assigned to this warden.',
            ], 403);
        }

        return null;
    }

    // Create student account and profile
    public function store(Request $request)
    {
        $roleName = $request->user()->role?->name;

        if (! in_array($roleName, ['Admin', 'Caretaker Operator'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'studentEmail' => 'required|email|unique:users,email',
            'hostelId' => 'required|exists:hostels,id',
            'roomNumber' => 'required|string',
            'enrollmentNo' => 'required|string|unique:students,enrollment_no',
            'course' => 'required|string|max:255',
            'biometricId' => 'required|string|unique:students,biometric_id',
            'bedNumber' => 'nullable|string',
            'parentName' => 'nullable|string|max:255',
            'parentEmail' => 'nullable|email',
        ]);

        $room = Room::where('hostel_id', $data['hostelId'])
            ->where('room_number', $data['roomNumber'])
            ->first();

        if (! $room) {
            return response()->json([
                'success' => false,
                'message' => 'Selected room does not exist in this hostel.',
            ], 422);
        }

        if ($room->students()->count() >= $room->capacity) {
            return response()->json([
                'success' => false,
                'message' => 'Selected room is already full.',
            ], 422);
        }

        $studentRole = Role::where('name', 'Student')->first();

        if (! $studentRole) {
            return response()->json([
                'success' => false,
                'message' => 'Student role has not been configured.',
            ], 422);
        }

        $plainPassword = $request->input('password') ?: 'student123';

        $student = DB::transaction(function () use ($data, $room, $studentRole, $plainPassword) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['studentEmail'],
                'password' => Hash::make($plainPassword),
                'role_id' => $studentRole->id,
                'hostel_id' => $data['hostelId'],
                'is_active' => true,
            ]);

            return Student::create([
                'user_id' => $user->id,
                'hostel_id' => $data['hostelId'],
                'room_id' => $room->id,
                'enrollment_no' => $data['enrollmentNo'],
                'course' => $data['course'],
                'biometric_id' => $data['biometricId'],
                'bed_number' => $data['bedNumber'] ?? 'A',
                'parent_guardian_name' => $data['parentName'] ?? null,
                'parent_email' => $data['parentEmail'] ?? null,
                'verification_status' => 'pending_verification',
            ]);
        });

        app(AuditService::class)->log(
            'Student Created',
            'Student',
            $student->id,
            'Created student profile for enrollment number '.$student->enrollment_no,
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Student submitted for verification.',
            'student' => $student->load('user', 'hostel', 'room'),
            'credentials' => [
                'name' => $data['name'],
                'email' => $data['studentEmail'],
                'password' => $plainPassword,
                'role' => 'student',
            ],
        ], 201);
    }

    private function formatStudentResponse(Student $student): array
    {
        return [
            'id' => (string) $student->id,
            'enrollmentNo' => $student->enrollment_no,
            'enrollment_no' => $student->enrollment_no,
            'name' => $student->user?->name ?? 'Student '.$student->enrollment_no,
            'course' => $student->course,
            'semester' => 1,
            'gender' => 'male',
            'hostelId' => (string) $student->hostel_id,
            'hostel_id' => $student->hostel_id,
            'block' => 'Block A',
            'roomNumber' => $student->room?->room_number ?? '',
            'room_id' => $student->room_id,
            'bedNumber' => $student->bed_number ?? 'A',
            'bed_number' => $student->bed_number ?? 'A',
            'biometricId' => $student->biometric_id,
            'biometric_id' => $student->biometric_id,
            'studentEmail' => $student->user?->email ?? '',
            'studentPhone' => '+91 9876543210',
            'parentName' => $student->parent_guardian_name ?? '',
            'parent_guardian_name' => $student->parent_guardian_name ?? '',
            'parentEmail' => $student->parent_email ?? '',
            'parent_email' => $student->parent_email ?? '',
            'parentPhone' => '+91 9876500000',
            'verificationStatus' => $student->verification_status ?? 'pending_verification',
            'verification_status' => $student->verification_status ?? 'pending_verification',
            'checkoutStatus' => 'active',
            'allotmentDate' => $student->created_at?->toDateString() ?? now()->toDateString(),
            'user' => $student->user,
            'hostel' => $student->hostel,
            'room' => $student->room,
        ];
    }

    // View all students
    public function index(Request $request)
    {
        if ($response = $this->checkStudentViewAccess($request)) {
            return $response;
        }

        $role = $request->user()->role?->name;

        $query = Student::with('user', 'hostel', 'room');

        if ($role === 'Residential Warden' || $role === 'Warden') {
            $query->where('hostel_id', $request->user()->hostel_id);
        }

        $students = $query->latest()->get()->map(fn ($s) => $this->formatStudentResponse($s));

        return response()->json([
            'success' => true,
            'total' => $students->count(),
            'students' => $students,
        ]);
    }

    // View student profile
    public function show(Request $request, $id)
    {
        $student = Student::with('user', 'hostel', 'room')
            ->findOrFail($id);

        $role = $request->user()->role?->name;

        $staffRoles = [
            'Admin',
            'Residential Warden',
            'Chief Warden',
            'Director',
            'Caretaker Operator',
        ];

        $isStaff = in_array($role, $staffRoles, true);
        $isOwner = (int) $student->user_id === (int) $request->user()->id;

        if (! $isStaff && ! $isOwner) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if (
            $role === 'Residential Warden' &&
            (int) $student->hostel_id !== (int) $request->user()->hostel_id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized hostel access.',
            ], 403);
        }

        $tokens = Token::where('student_id', $student->id)->get();
        $currentMonthTokens = $tokens->where('month_start', now()->startOfMonth()->toDateString())->sum('token_count');
        $lifetimeTokens = $tokens->sum('token_count');

        $status = 'none';
        if ($currentMonthTokens > 10) {
            $status = 'red_card_blacklist';
        } elseif ($currentMonthTokens >= 6) {
            $status = 'yellow_card';
        } elseif ($currentMonthTokens >= 1) {
            $status = 'normal_warning';
        }

        $disciplinary = [
            'currentMonth' => now()->format('F Y'),
            'currentMonthTokens' => $currentMonthTokens,
            'lifetimeTokens' => $lifetimeTokens,
            'disciplinaryStatus' => $status,
            'isBlacklisted' => $currentMonthTokens > 10,
            'history' => $tokens->map(fn ($t) => [
                'id' => (string) $t->id,
                'studentId' => (string) $t->student_id,
                'date' => $t->issued_date?->toDateString() ?? $t->created_at?->toDateString() ?? now()->toDateString(),
                'reason' => $t->reason,
                'tokensReceived' => $t->token_count,
                'warningCardStatus' => $status,
            ])->values(),
        ];

        return response()->json([
            'success' => true,
            'student' => $this->formatStudentResponse($student),
            'disciplinary' => $disciplinary,
        ]);
    }

    public function verify(Request $request)
    {
        $role = $request->user()->role?->name;
        if (! in_array($role, ['Admin', 'Residential Warden', 'Chief Warden', 'Caretaker Operator'], true)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'studentId' => ['required'],
            'action' => ['required', 'in:approve,reject'],
            'rejectionReason' => ['nullable', 'string', 'max:500'],
        ]);

        $student = Student::findOrFail($data['studentId']);

        if ($role === 'Residential Warden' && (int) $student->hostel_id !== (int) $request->user()->hostel_id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized hostel access.'], 403);
        }

        $isApproved = $data['action'] === 'approve';
        $student->update([
            'verification_status' => $isApproved ? Student::STATUS_VERIFIED : Student::STATUS_REJECTED,
        ]);

        $student->user?->update([
            'is_active' => $isApproved,
        ]);

        app(AuditService::class)->log(
            'Student Registration '.ucfirst($data['action']).'d',
            'Student',
            $student->id,
            $isApproved ? 'Approved student registration' : ('Rejected: '.($data['rejectionReason'] ?? 'No reason provided')),
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Student registration '.($isApproved ? 'approved' : 'rejected').' successfully.',
            'student' => $this->formatStudentResponse($student->fresh()->load('user', 'hostel', 'room')),
        ]);
    }

    public function submitRegistration(Request $request)
    {
        $user = $request->user();
        $student = $user->student;

        if (! $student) {
            return response()->json(['success' => false, 'message' => 'Student profile not found.'], 404);
        }

        $data = $request->validate([
            'enrollmentNo' => ['required', 'string'],
            'course' => ['required', 'string'],
            'hostelId' => ['required'],
            'roomNumber' => ['required', 'string'],
            'biometricId' => ['nullable', 'string'],
            'parentName' => ['nullable', 'string'],
            'parentEmail' => ['nullable', 'email'],
            'parentPhone' => ['nullable', 'string'],
        ]);

        $student->update([
            'enrollment_no' => $data['enrollmentNo'],
            'course' => $data['course'],
            'parent_guardian_name' => $data['parentName'] ?? $student->parent_guardian_name,
            'parent_email' => $data['parentEmail'] ?? $student->parent_email,
            'verification_status' => Student::STATUS_PENDING_VERIFICATION,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Registration submitted for warden verification.',
            'student' => $this->formatStudentResponse($student->fresh()->load('user', 'hostel', 'room')),
        ]);
    }

    public function warningTickets(Request $request)
    {
        $tickets = Ticket::with(['violation.student.user', 'violation.student.hostel', 'violation.student.room'])
            ->latest('issue_date')
            ->get()
            ->map(fn ($t) => [
                'id' => (string) $t->id,
                'ticketNumber' => 'WT-'.str_pad($t->id, 4, '0', STR_PAD_LEFT),
                'studentId' => (string) $t->violation?->student_id,
                'studentName' => $t->violation?->student?->user?->name ?? 'Unknown Student',
                'enrollmentNo' => $t->violation?->student?->enrollment_no ?? '',
                'hostel' => $t->violation?->student?->hostel?->name ?? '',
                'roomNumber' => $t->violation?->student?->room?->room_number ?? '',
                'tier' => 1,
                'tokenCount' => 1,
                'warningCard' => 'normal_warning',
                'issueDate' => $t->issue_date?->toDateString() ?? now()->toDateString(),
                'status' => $t->warning_status ?? 'Issued',
                'remarks' => $t->violation?->description ?? 'Absence without approved leave',
            ]);

        return response()->json([
            'success' => true,
            'tickets' => $tickets,
        ]);
    }

    // Allocate or change student's room
    // Only Admin and Residential Warden
    public function allocateRoom(Request $request, $id)
    {
        $role = $request->user()->role?->name;

        if (! in_array($role, ['Admin', 'Residential Warden'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only Admin and Residential Warden can allocate rooms.',
            ], 403);
        }

        $data = $request->validate([
            'hostel_id' => ['required', 'exists:hostels,id'],
            'room_id' => ['required', 'exists:rooms,id'],
            'bed_number' => ['required', 'string', 'max:255'],
        ]);

        if (
            $role === 'Residential Warden' &&
            (int) $data['hostel_id'] !== (int) $request->user()->hostel_id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'You can only allocate rooms in your assigned hostel.',
            ], 403);
        }

        $student = Student::findOrFail($id);

        $room = Room::where('id', $data['room_id'])
            ->where('hostel_id', $data['hostel_id'])
            ->first();

        if (! $room) {
            return response()->json([
                'success' => false,
                'message' => 'Selected room does not belong to the selected hostel.',
            ], 422);
        }

        if (
            $role === 'Residential Warden' &&
            (int) $student->hostel_id !== (int) $request->user()->hostel_id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot allocate a student from another hostel.',
            ], 403);
        }

        $oldRoomId = $student->room_id;
        $oldHostelId = $student->hostel_id;

        DB::transaction(function () use ($student, $room, $data) {
            $lockedRoom = Room::whereKey($room->id)
                ->lockForUpdate()
                ->firstOrFail();

            $currentOccupancy = Student::where('room_id', $lockedRoom->id)
                ->where('id', '!=', $student->id)
                ->count();

            if ($currentOccupancy >= $lockedRoom->capacity) {
                throw ValidationException::withMessages([
                    'room_id' => ['Selected room is already full.'],
                ]);
            }

            $student->update([
                'hostel_id' => $lockedRoom->hostel_id,
                'room_id' => $lockedRoom->id,
                'bed_number' => $data['bed_number'],
            ]);

            $student->user()->update([
                'hostel_id' => $lockedRoom->hostel_id,
            ]);
        });

        app(AuditService::class)->log(
            'Room Allocated',
            'Student',
            $student->id,
            'Room allocation changed from hostel '.$oldHostelId.
            ', room '.$oldRoomId.' to hostel '.$data['hostel_id'].
            ', room '.$data['room_id'],
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Room allocated successfully.',
            'student' => $student->fresh()->load('user', 'hostel', 'room'),
        ]);
    }

    // Update student details
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
            'parent_guardian_name' => 'sometimes|nullable|string|max:255',
            'parent_email' => 'sometimes|nullable|email',
            'verification_status' => 'sometimes|required|in:pending_verification,verified,rejected',
        ]);

        $hostelId = $data['hostel_id'] ?? $student->hostel_id;
        $roomId = $data['room_id'] ?? $student->room_id;

        $room = Room::where('id', $roomId)
            ->where('hostel_id', $hostelId)
            ->first();

        if (! $room) {
            return response()->json([
                'success' => false,
                'message' => 'Selected room does not belong to this hostel.',
            ], 422);
        }

        if (
            (int) $roomId !== (int) $student->room_id &&
            $room->students()->count() >= $room->capacity
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Selected room is already full.',
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

            if (isset($data['verification_status'])) {
                $userData['is_active'] = $data['verification_status'] === 'verified';
            }

            if (! empty($userData)) {
                $student->user()->update($userData);
            }
        });

        app(AuditService::class)->log(
            'Student Updated',
            'Student',
            $student->id,
            'Updated student profile for enrollment number '.$student->enrollment_no,
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Student details updated successfully.',
            'student' => $student->fresh()->load('user', 'hostel', 'room'),
        ]);
    }

    public function deviceRegistration(Request $request)
    {
        $data = $request->validate([
            'enrollmentNo' => ['required', 'string'],
            'name' => ['required', 'string'],
            'course' => ['nullable', 'string'],
            'hostelId' => ['required'],
            'roomNumber' => ['required', 'string'],
            'biometricId' => ['required', 'string'],
            'deviceSerial' => ['required', 'string'],
            'studentEmail' => ['required', 'email'],
        ]);

        $hostelId = is_numeric($data['hostelId']) ? (int) $data['hostelId'] : 1;
        $room = Room::firstOrCreate(
            ['hostel_id' => $hostelId, 'room_number' => $data['roomNumber']],
            ['capacity' => 3]
        );

        $studentRole = Role::firstOrCreate(['name' => 'Student'], ['description' => 'Student role']);

        $plainPassword = $request->input('password') ?: 'student123';

        $existingStudent = Student::with('user')->where('biometric_id', $data['biometricId'])->first();

        if ($existingStudent && $existingStudent->user) {
            $user = $existingStudent->user;
            $user->name = $data['name'];
            if (! empty($data['studentEmail'])) {
                $user->email = $data['studentEmail'];
            }
            $user->hostel_id = $hostelId;
            if ($request->filled('password')) {
                $user->password = Hash::make($plainPassword);
            }
            $user->save();
        } else {
            $user = User::updateOrCreate(
                ['email' => $data['studentEmail']],
                [
                    'name' => $data['name'],
                    'password' => Hash::make($plainPassword),
                    'role_id' => $studentRole->id,
                    'hostel_id' => $hostelId,
                    'is_active' => true,
                ]
            );
        }

        $student = Student::updateOrCreate(
            ['biometric_id' => $data['biometricId']],
            [
                'user_id' => $user->id,
                'hostel_id' => $hostelId,
                'room_id' => $room->id,
                'enrollment_no' => strtoupper($data['enrollmentNo']),
                'course' => $data['course'] ?? 'B.Tech CSE',
                'bed_number' => $request->input('bedNumber', 'A'),
                'parent_guardian_name' => $request->input('parentName'),
                'parent_email' => $request->input('parentEmail'),
                'verification_status' => 'verified',
            ]
        );

        // Sync name into MongoDB user_info_result and queue SET_USER_INFO to machine terminal
        try {
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new Manager($mongoUri);
            $bulk = new BulkWrite;

            $bulk->update(
                ['user_id' => (string) $data['biometricId']],
                ['$set' => [
                    'user_id' => (string) $data['biometricId'],
                    'dev_id' => $data['deviceSerial'] ?? 'RSS20241199684',
                    'name' => $data['name'],
                    'info' => json_encode([
                        'user_id' => (string) $data['biometricId'],
                        'user_name' => $data['name'],
                        'privilege' => 'User',
                    ]),
                    'updated_at' => now()->format('Y-m-d H:i:s'),
                ]],
                ['upsert' => true]
            );

            $transId = (string) rand(10000, 99999);
            $nextId = (int) (round(microtime(true) * 1000) % 100000000);
            $bulk->insert([
                'trans_id' => $transId,
                'dev_id' => $data['deviceSerial'] ?? 'RSS20241199684',
                'cmd_code' => 'SET_USER_INFO',
                'cmd_param' => json_encode([
                    'user_id' => (string) $data['biometricId'],
                    'user_name' => $data['name'],
                ]),
                'trans_status' => 'pending',
                'trans_status_update_time' => now()->format('Y-m-d H:i:s'),
                'result' => null,
                'id' => $nextId,
            ]);

            $manager->executeBulkWrite('biometric_db.command_request_pending', $bulk);
        } catch (\Throwable $e) {
            \Log::warning('MongoDB biometric sync skipped: '.$e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Device-linked student registration verified and added to Active Residents successfully.',
            'student' => $this->formatStudentResponse($student),
            'credentials' => [
                'name' => $data['name'],
                'email' => $data['studentEmail'],
                'password' => $plainPassword,
                'role' => 'student',
            ],
        ], 201);
    }
}
