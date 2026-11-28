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
use App\Services\ClockService;
use App\Services\DefaulterEvaluationService;
use App\Services\SemesterService;
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
        $user = $request->user();
        $role = $user->role?->name;

        $allowedRoles = [
            'Admin',
            'Residential Warden',
            'Warden',
            'Chief Warden',
            'Director',
            'Caretaker',
            'Caretaker Operator',
        ];

        if (! in_array($role, $allowedRoles, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if ($user->isHostelScoped() && ! $user->hostel_id) {
            return response()->json([
                'success' => false,
                'message' => 'No hostel is assigned to this account.',
            ], 403);
        }

        return null;
    }

    private function checkStudentManageAccess(Request $request, ?int $targetHostelId = null)
    {
        $user = $request->user();

        if (! $user || ! $user->canManageStudents()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if ($user->isCaretaker()) {
            if (! $user->hostel_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hostel is assigned to this caretaker.',
                ], 403);
            }

            if ($targetHostelId !== null && (int) $targetHostelId !== (int) $user->hostel_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'You can only manage students within your assigned hostel.',
                ], 403);
            }
        }

        return null;
    }

    private function checkStudentCredentialAccess(Request $request, ?int $targetHostelId = null)
    {
        $user = $request->user();
        $role = $user?->role?->name;

        if (! $user || ! in_array($role, [
            'Admin',
            'Caretaker Operator',
            'Residential Warden',
            'Warden',
            'Caretaker',
        ], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if ($user->isHostelScoped()) {
            if (! $user->hostel_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hostel is assigned to this account.',
                ], 403);
            }

            if ($targetHostelId !== null && (int) $targetHostelId !== (int) $user->hostel_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'You can only update student credentials within your assigned hostel.',
                ], 403);
            }
        }

        return null;
    }

    private function syncTodayPunchesAfterStudentLink(): void
    {
        try {
            $today = app(ClockService::class)->current()->toDateString();
            app(DefaulterEvaluationService::class)->invalidateAndSyncForDate($today);
        } catch (\Throwable) {
        }
    }

    // Create student account and profile
    public function store(Request $request)
    {
        if ($response = $this->checkStudentManageAccess($request)) {
            return $response;
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

        if ($response = $this->checkStudentManageAccess($request, (int) $data['hostelId'])) {
            return $response;
        }

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
                'credential_secret' => $plainPassword,
            ]);
        });

        app(AuditService::class)->log(
            'Student Created',
            'Student',
            $student->id,
            'Created student profile for enrollment number '.$student->enrollment_no,
            $request->user()->id
        );

        $this->syncTodayPunchesAfterStudentLink();

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

    private function resolveVisibleStudentPassword(Student $student): ?string
    {
        try {
            $stored = $student->credential_secret;
            if (is_string($stored) && $stored !== '') {
                return $stored;
            }
        } catch (\Throwable) {
        }

        if ($student->user && Hash::check('student123', $student->user->password)) {
            return 'student123';
        }

        return null;
    }

    private function formatStudentResponse(Student $student, bool $includePassword = false): array
    {
        $payload = [
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

        if ($includePassword) {
            $payload['loginPassword'] = $this->resolveVisibleStudentPassword($student);
        }

        return $payload;
    }

    // View all students
    public function index(Request $request)
    {
        if ($response = $this->checkStudentViewAccess($request)) {
            return $response;
        }

        $currentUser = $request->user();
        $canViewCredentials = in_array($currentUser->role?->name, [
            'Admin',
            'Caretaker Operator',
            'Residential Warden',
            'Warden',
            'Caretaker',
        ], true);

        $query = Student::with('user', 'hostel', 'room');

        if ($currentUser->isHostelScoped()) {
            $query->where('hostel_id', $currentUser->hostel_id);
        }

        $students = $query->latest()->get()->map(
            fn ($s) => $this->formatStudentResponse($s, $canViewCredentials)
        );

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

        $currentUser = $request->user();
        $role = $currentUser->role?->name;

        $staffRoles = [
            'Admin',
            'Residential Warden',
            'Warden',
            'Chief Warden',
            'Director',
            'Caretaker',
            'Caretaker Operator',
        ];

        $isStaff = in_array($role, $staffRoles, true);
        $isOwner = (int) $student->user_id === (int) $currentUser->id;

        if (! $isStaff && ! $isOwner) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if (
            $currentUser->isHostelScoped() &&
            (int) $student->hostel_id !== (int) $currentUser->hostel_id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized hostel access.',
            ], 403);
        }

        $semester = app(SemesterService::class)->active();
        $semStart = $semester['startDate'];
        $semEnd = $semester['endDate'];

        $tokens = Token::where('student_id', $student->id)
            ->orderByDesc('issued_date')
            ->orderByDesc('id')
            ->get();

        $semesterTokens = $tokens->filter(function (Token $token) use ($semStart, $semEnd): bool {
            $d = $token->issued_date?->toDateString() ?? $token->created_at?->toDateString();

            return $d !== null && $d >= $semStart && $d <= $semEnd;
        });

        $currentSemesterTokens = (int) $semesterTokens->sum('token_count');
        $lifetimeTokens = (int) $tokens->sum('token_count');

        $status = 'none';
        if ($currentSemesterTokens > 10) {
            $status = 'red_card_blacklist';
        } elseif ($currentSemesterTokens >= 6) {
            $status = 'yellow_card';
        } elseif ($currentSemesterTokens >= 1) {
            $status = 'normal_warning';
        }

        $disciplinary = [
            'currentSemester' => $semStart.' to '.$semEnd,
            'currentSemesterStart' => $semStart,
            'currentSemesterEnd' => $semEnd,
            'currentSemesterDurationDays' => $semester['durationDays'],
            'currentSemesterTokens' => $currentSemesterTokens,
            'currentMonth' => $semStart.' to '.$semEnd,
            'currentMonthTokens' => $currentSemesterTokens,
            'lifetimeTokens' => $lifetimeTokens,
            'disciplinaryStatus' => $status,
            'isBlacklisted' => $currentSemesterTokens > 10,
            'history' => $tokens->map(function (Token $t) use ($semStart, $semEnd, $status) {
                $tokenDate = $t->issued_date?->toDateString() ?? $t->created_at?->toDateString() ?? now()->toDateString();
                $inActiveSemester = $tokenDate >= $semStart && $tokenDate <= $semEnd;

                return [
                    'id' => (string) $t->id,
                    'studentId' => (string) $t->student_id,
                    'date' => $tokenDate,
                    'reason' => $t->reason,
                    'tokensReceived' => $t->token_count,
                    'warningCardStatus' => $inActiveSemester ? $status : 'none',
                    'inActiveSemester' => $inActiveSemester,
                ];
            })->values(),
        ];

        return response()->json([
            'success' => true,
            'student' => $this->formatStudentResponse($student),
            'disciplinary' => $disciplinary,
        ]);
    }

    public function verify(Request $request)
    {
        $currentUser = $request->user();
        $role = $currentUser->role?->name;
        if (! in_array($role, ['Admin', 'Residential Warden', 'Warden', 'Chief Warden', 'Caretaker', 'Caretaker Operator'], true)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'studentId' => ['required'],
            'action' => ['required', 'in:approve,reject'],
            'rejectionReason' => ['nullable', 'string', 'max:500'],
        ]);

        $student = Student::findOrFail($data['studentId']);

        if ($currentUser->isHostelScoped() && (int) $student->hostel_id !== (int) $currentUser->hostel_id) {
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

        if ($isApproved) {
            $this->syncTodayPunchesAfterStudentLink();
        }

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
        $currentUser = $request->user();
        $semester = app(SemesterService::class)->active();
        $semStart = $semester['startDate'];
        $semEnd = $semester['endDate'];

        $ticketsQuery = Ticket::with(['violation.student.user', 'violation.student.hostel', 'violation.student.room'])
            ->whereDate('issue_date', '>=', $semStart)
            ->whereDate('issue_date', '<=', $semEnd)
            ->latest('issue_date');

        if ($currentUser->isHostelScoped()) {
            $ticketsQuery->whereHas('violation.student', function ($q) use ($currentUser) {
                $q->where('hostel_id', $currentUser->hostel_id);
            });
        }

        $ticketRows = $ticketsQuery->get();
        $studentIds = $ticketRows->pluck('violation.student_id')->filter()->unique()->values();
        $tokensByStudent = Token::query()
            ->whereIn('student_id', $studentIds)
            ->whereDate('issued_date', '>=', $semStart)
            ->whereDate('issued_date', '<=', $semEnd)
            ->selectRaw('student_id, SUM(token_count) as total_tokens')
            ->groupBy('student_id')
            ->pluck('total_tokens', 'student_id');

        $tickets = $ticketRows
            ->map(function ($t) use ($tokensByStudent) {
                $sid = $t->violation?->student_id;
                $tokenTotal = (int) ($tokensByStudent[$sid] ?? 1);
                $card = $tokenTotal > 10
                    ? 'red_card_blacklist'
                    : ($tokenTotal >= 6 ? 'yellow_card' : 'normal_warning');

                return [
                    'id' => (string) $t->id,
                    'ticketNumber' => 'WT-'.str_pad($t->id, 4, '0', STR_PAD_LEFT),
                    'studentId' => (string) $sid,
                    'studentName' => $t->violation?->student?->user?->name ?? 'Unknown Student',
                    'enrollmentNo' => $t->violation?->student?->enrollment_no ?? '',
                    'hostel' => $t->violation?->student?->hostel?->name ?? '',
                    'roomNumber' => $t->violation?->student?->room?->room_number ?? '',
                    'tier' => $tokenTotal > 10 ? 3 : ($tokenTotal >= 6 ? 2 : 1),
                    'tokenCount' => $tokenTotal,
                    'warningCard' => $card,
                    'issueDate' => $t->issue_date?->toDateString() ?? now()->toDateString(),
                    'status' => $t->warning_status ?? 'Issued',
                    'remarks' => $t->violation?->description ?? 'Absence without approved leave',
                ];
            });

        return response()->json([
            'success' => true,
            'semester' => $semester,
            'tickets' => $tickets,
        ]);
    }

    // Allocate or change student's room
    public function allocateRoom(Request $request, $id)
    {
        $currentUser = $request->user();
        $role = $currentUser->role?->name;

        if (! in_array($role, ['Admin', 'Residential Warden', 'Warden', 'Caretaker', 'Caretaker Operator'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to allocate rooms.',
            ], 403);
        }

        $data = $request->validate([
            'hostel_id' => ['required', 'exists:hostels,id'],
            'room_id' => ['required', 'exists:rooms,id'],
            'bed_number' => ['required', 'string', 'max:255'],
        ]);

        if (
            $currentUser->isHostelScoped() &&
            (int) $data['hostel_id'] !== (int) $currentUser->hostel_id
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
            $currentUser->isHostelScoped() &&
            (int) $student->hostel_id !== (int) $currentUser->hostel_id
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
        $student = Student::with('user')->findOrFail($id);

        if ($response = $this->checkStudentCredentialAccess($request, (int) $student->hostel_id)) {
            return $response;
        }

        $normalized = [];
        if ($request->has('studentEmail') && ! $request->has('email')) {
            $normalized['email'] = $request->input('studentEmail');
        }
        if ($request->has('hostelId') && ! $request->has('hostel_id')) {
            $normalized['hostel_id'] = $request->input('hostelId');
        }
        if ($request->has('enrollmentNo') && ! $request->has('enrollment_no')) {
            $normalized['enrollment_no'] = $request->input('enrollmentNo');
        }
        if ($request->has('biometricId') && ! $request->has('biometric_id')) {
            $normalized['biometric_id'] = $request->input('biometricId');
        }
        if ($request->has('bedNumber') && ! $request->has('bed_number')) {
            $normalized['bed_number'] = $request->input('bedNumber');
        }
        if ($request->has('parentName') && ! $request->has('parent_guardian_name')) {
            $normalized['parent_guardian_name'] = $request->input('parentName');
        }
        if ($request->has('parentEmail') && ! $request->has('parent_email')) {
            $normalized['parent_email'] = $request->input('parentEmail');
        }
        if ($request->has('verificationStatus') && ! $request->has('verification_status')) {
            $normalized['verification_status'] = $request->input('verificationStatus');
        }
        if (! empty($normalized)) {
            $request->merge($normalized);
        }

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => [
                'sometimes',
                'required',
                'email',
                Rule::unique('users', 'email')->ignore($student->user_id),
            ],
            'password' => 'sometimes|nullable|string|min:6|max:255',
            'hostel_id' => 'sometimes|required|exists:hostels,id',
            'room_id' => 'sometimes|required|exists:rooms,id',
            'roomNumber' => 'sometimes|required|string',
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

        $hostelId = (int) ($data['hostel_id'] ?? $student->hostel_id);
        if ($response = $this->checkStudentCredentialAccess($request, $hostelId)) {
            return $response;
        }

        $roomId = $data['room_id'] ?? $student->room_id;
        if (isset($data['roomNumber']) && ! isset($data['room_id'])) {
            $resolvedRoom = Room::where('hostel_id', $hostelId)
                ->where('room_number', $data['roomNumber'])
                ->first();
            if (! $resolvedRoom) {
                return response()->json([
                    'success' => false,
                    'message' => 'Selected room does not exist in this hostel.',
                ], 422);
            }
            $roomId = $resolvedRoom->id;
        }
        unset($data['roomNumber']);

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

            unset($studentData['name'], $studentData['email'], $studentData['password']);

            $student->update(array_merge($studentData, [
                'hostel_id' => $hostelId,
                'room_id' => $roomId,
                'credential_secret' => ! empty($data['password']) ? $data['password'] : $student->credential_secret,
            ]));

            $userData = [];

            if (isset($data['name'])) {
                $userData['name'] = $data['name'];
            }

            if (isset($data['email'])) {
                $userData['email'] = $data['email'];
            }

            if (! empty($data['password'])) {
                $userData['password'] = Hash::make($data['password']);
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

        $this->syncTodayPunchesAfterStudentLink();

        $freshStudent = $student->fresh()->load('user', 'hostel', 'room');

        return response()->json([
            'success' => true,
            'message' => 'Student details updated successfully.',
            'student' => $this->formatStudentResponse($freshStudent, true),
        ]);
    }

    /**
     * View a student's login credentials (email and current password if available).
     */
    public function showCredentials(Request $request, $id)
    {
        $student = Student::with('user', 'hostel', 'room')->findOrFail($id);

        if ($response = $this->checkStudentCredentialAccess($request, (int) $student->hostel_id)) {
            return $response;
        }

        if (! $student->user) {
            return response()->json([
                'success' => false,
                'message' => 'Student login account not found.',
            ], 404);
        }

        $loginPassword = $this->resolveVisibleStudentPassword($student);

        return response()->json([
            'success' => true,
            'credentials' => [
                'studentId' => (string) $student->id,
                'name' => $student->user->name,
                'enrollmentNo' => $student->enrollment_no,
                'studentEmail' => $student->user->email,
                'loginPassword' => $loginPassword,
                'hasKnownPassword' => $loginPassword !== null,
            ],
        ]);
    }

    /**
     * Update student login credentials (email and/or password) by Mehra Sir or Residential Warden.
     */
    public function updateCredentials(Request $request, $id)
    {
        $student = Student::with('user', 'hostel', 'room')->findOrFail($id);

        if ($response = $this->checkStudentCredentialAccess($request, (int) $student->hostel_id)) {
            return $response;
        }

        if (! $student->user) {
            return response()->json([
                'success' => false,
                'message' => 'Student login account not found.',
            ], 404);
        }

        if ($request->has('studentEmail') && ! $request->has('email')) {
            $request->merge(['email' => $request->input('studentEmail')]);
        }

        $data = $request->validate([
            'email' => [
                'sometimes',
                'required',
                'email',
                Rule::unique('users', 'email')->ignore($student->user_id),
            ],
            'password' => ['sometimes', 'nullable', 'string', 'min:6', 'max:255'],
        ]);

        $userUpdates = [];
        $changedParts = [];

        if (isset($data['email']) && $data['email'] !== $student->user->email) {
            $userUpdates['email'] = trim($data['email']);
            $changedParts[] = 'login email';
        }

        if (! empty($data['password'])) {
            $userUpdates['password'] = Hash::make($data['password']);
            $changedParts[] = 'password';
        }

        if (empty($userUpdates)) {
            return response()->json([
                'success' => false,
                'message' => 'Please enter a new email address or a new password (min 6 characters).',
            ], 422);
        }

        DB::transaction(function () use ($student, $userUpdates, $data) {
            $student->user->update($userUpdates);

            if (! empty($data['password'])) {
                $student->update(['credential_secret' => $data['password']]);
            }
        });

        app(AuditService::class)->log(
            'Student Credentials Updated',
            'Student',
            $student->id,
            'Updated '.implode(' & ', $changedParts).' for student '.$student->enrollment_no,
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Student credentials updated successfully ('.implode(' & ', $changedParts).').',
            'student' => $this->formatStudentResponse($student->fresh()->load('user', 'hostel', 'room'), true),
        ]);
    }

    public function deviceRegistration(Request $request)
    {
        if ($response = $this->checkStudentManageAccess($request)) {
            return $response;
        }

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

        if ($response = $this->checkStudentManageAccess($request, $hostelId)) {
            return $response;
        }
        $room = Room::firstOrCreate(
            ['hostel_id' => $hostelId, 'room_number' => $data['roomNumber']],
            ['capacity' => 3]
        );

        $studentRole = Role::firstOrCreate(['name' => 'Student'], ['description' => 'Student role']);

        $plainPassword = $request->input('password') ?: 'student123';

        $existingStudent = Student::with('user')->where('biometric_id', $data['biometricId'])->first();

        if ($existingStudent && ($response = $this->checkStudentManageAccess($request, (int) $existingStudent->hostel_id))) {
            return $response;
        }

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
                'credential_secret' => ($existingStudent && ! $request->filled('password'))
                    ? $existingStudent->credential_secret
                    : $plainPassword,
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

        $this->syncTodayPunchesAfterStudentLink();

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
