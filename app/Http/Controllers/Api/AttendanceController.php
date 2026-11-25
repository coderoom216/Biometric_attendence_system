<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Audit;
use App\Models\Leave;
use App\Models\Student;
use App\Services\ClockService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceController extends Controller
{
    private function clock(): Carbon
    {
        return app(ClockService::class)->current();
    }

    private function filteredQuery(Request $request): Builder
    {
        $user = $request->user();
        $role = strtolower(str_replace(' ', '_', $user->role?->name ?? ''));

        $query = Attendance::query()->with([
            'student.user',
            'student.hostel',
            'student.room',
            'markedBy',
        ]);

        if ($role === 'student') {
            $student = $user->student;

            abort_unless($student, 403, 'Student profile not found.');

            $query->where('student_id', $student->id);
        } elseif ($role === 'residential_warden') {
            abort_unless($user->hostel_id, 403, 'No hostel assigned.');

            $query->whereHas('student', function (Builder $studentQuery) use ($user) {
                $studentQuery->where('hostel_id', $user->hostel_id);
            });
        } elseif (! in_array($role, [
            'admin',
            'chief_warden',
            'director',
            'caretaker_operator',
        ], true)) {
            abort(403, 'You are not authorized to view attendance records.');
        }

        $validated = $request->validate([
            'startDate' => ['nullable', 'date_format:Y-m-d'],
            'endDate' => ['nullable', 'date_format:Y-m-d'],
            'hostelId' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:present,late,approved_leave,absent'],
            'search' => ['nullable', 'string', 'max:150'],
        ]);

        if (! empty($validated['startDate']) && ! empty($validated['endDate'])) {
            abort_if(
                $validated['endDate'] < $validated['startDate'],
                422,
                'End date cannot be earlier than start date.'
            );

            $query->whereBetween('attendance_date', [
                $validated['startDate'],
                $validated['endDate'],
            ]);
        } elseif (! empty($validated['startDate'])) {
            $query->whereDate('attendance_date', '>=', $validated['startDate']);
        } elseif (! empty($validated['endDate'])) {
            $query->whereDate('attendance_date', '<=', $validated['endDate']);
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['hostelId'])) {
            $hostelId = $validated['hostelId'];

            $aliases = [
                'h-shivalik' => ['Boys Hostel 1', 'Shivalik', 'BH1'],
                'h-mandakini' => ['Girls Hostel', 'Mandakini', 'GH'],
                'h-nilgiri' => ['Boys Hostel 2', 'Nilgiri', 'BH2'],
            ];

            if (ctype_digit($hostelId)) {
                $query->whereHas('student', function (Builder $studentQuery) use ($hostelId) {
                    $studentQuery->where('hostel_id', (int) $hostelId);
                });
            } else {
                $query->whereHas('student.hostel', function (Builder $hostelQuery) use ($hostelId, $aliases) {
                    $hostelQuery->where('code', $hostelId);

                    if (isset($aliases[$hostelId])) {
                        $hostelQuery->orWhereIn('name', $aliases[$hostelId]);
                    }
                });
            }
        }

        if (! empty($validated['search'])) {
            $search = $validated['search'];

            $query->whereHas('student', function (Builder $studentQuery) use ($search) {
                $studentQuery
                    ->where('enrollment_no', 'like', "%{$search}%")
                    ->orWhereHas('user', function (Builder $userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('room', function (Builder $roomQuery) use ($search) {
                        $roomQuery->where('room_number', 'like', "%{$search}%");
                    });
            });
        }

        return $query->orderByDesc('attendance_date')->orderByDesc('id');
    }

    private function scopedStudents(Request $request): Builder
    {
        $user = $request->user();
        $role = strtolower(str_replace(' ', '_', $user->role?->name ?? ''));

        $query = Student::query()->with([
            'user',
            'hostel',
            'room',
        ]);

        if ($role === 'student') {
            abort_unless($user->student, 403, 'Student profile not found.');

            $query->whereKey($user->student->id);
        } elseif ($role === 'residential_warden') {
            abort_unless($user->hostel_id, 403, 'No hostel assigned.');

            $query->where('hostel_id', $user->hostel_id);
        } elseif (! in_array($role, [
            'admin',
            'chief_warden',
            'director',
            'caretaker_operator',
        ], true)) {
            abort(403, 'You are not authorized to view attendance.');
        }

        return $query;
    }

    private function frontendHostelId($hostel): ?string
    {
        if (! $hostel) {
            return null;
        }

        $code = strtolower((string) $hostel->code);
        $name = strtolower((string) $hostel->name);

        if (
            $code === 'h-shivalik' ||
            str_contains($name, 'shivalik') ||
            str_contains($name, 'boys hostel 1') ||
            $code === 'bh1'
        ) {
            return 'h-shivalik';
        }

        if (
            $code === 'h-mandakini' ||
            str_contains($name, 'mandakini') ||
            str_contains($name, 'girls hostel') ||
            $code === 'gh'
        ) {
            return 'h-mandakini';
        }

        if (
            $code === 'h-nilgiri' ||
            str_contains($name, 'nilgiri') ||
            str_contains($name, 'boys hostel 2') ||
            $code === 'bh2'
        ) {
            return 'h-nilgiri';
        }

        return (string) $hostel->id;
    }

    private function formatRecord(Attendance $attendance): array
    {
        $student = $attendance->student;

        return [
            'id' => (string) $attendance->id,
            'studentId' => (string) $student->id,
            'enrollmentNo' => $student->enrollment_no,
            'studentName' => $student->user?->name ?? 'Unknown Student',
            'hostelId' => $this->frontendHostelId($student->hostel),
            'block' => null,
            'roomNumber' => $student->room?->room_number,
            'date' => $attendance->attendance_date?->format('Y-m-d'),
            'status' => $attendance->status,
            'punchTime' => $attendance->punch_time,
            'isDefaulter' => (bool) $attendance->is_defaulter,
            'remarks' => $attendance->remarks,
            'evaluatedAt' => null,
            'correctedBy' => null,
            'correctedAt' => null,
            'correctionReason' => null,
        ];
    }

    /**
     * Today's attendance summary.
     */
    public function today(Request $request)
    {
        $current = $this->clock();
        $date = $current->toDateString();

        $students = $this->scopedStudents($request)->get();

        $studentIds = $students->pluck('id');

        $records = Attendance::with([
            'student.user',
            'student.hostel',
            'student.room',
            'markedBy',
        ])
            ->whereIn('student_id', $studentIds)
            ->whereDate('attendance_date', $date)
            ->get();

        $approvedLeaveIds = Leave::whereIn('student_id', $studentIds)
            ->where('approval_status', 'approved')
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->pluck('student_id')
            ->unique();

        $attendanceLeaveIds = $records
            ->where('status', 'approved_leave')
            ->pluck('student_id');

        $approvedLeaveCount = $approvedLeaveIds
            ->merge($attendanceLeaveIds)
            ->unique()
            ->count();

        $present = $records->where('status', 'present')->count();
        $late = $records->where('status', 'late')->count();

        $defaulters = $records->filter(function ($record) {
            return $record->is_defaulter || $record->status === 'absent';
        })->count();

        $isPastDefaulterTime = $current->format('H:i:s')
            >= ClockService::DEFAULTER_TIME;

        $absent = $isPastDefaulterTime ? $defaulters : 0;

        return response()->json([
            'success' => true,
            'date' => $date,
            'virtualTime' => $current->format('H:i:s'),
            'isPastCutoff' => $current->format('H:i:s') > ClockService::CUTOFF_TIME,
            'isPastDefaulterTime' => $isPastDefaulterTime,
            'stats' => [
                'total' => $students->count(),
                'present' => $present,
                'late' => $late,
                'approvedLeave' => $approvedLeaveCount,
                'absent' => $absent,
                'defaulters' => $defaulters,
            ],
            'records' => $records->map(
                fn (Attendance $attendance) => $this->formatRecord($attendance)
            )->values(),
        ]);
    }

    /**
     * Defaulter list. It becomes visible after 10 PM evaluation time.
     */
    public function defaulters(Request $request)
    {
        $current = $this->clock();

        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'hostelId' => ['nullable', 'string', 'max:100'],
        ]);

        $targetDate = $validated['date'] ?? $current->toDateString();

        $isVisible = $targetDate < $current->toDateString()
            || (
                $targetDate === $current->toDateString()
                && $current->format('H:i:s') >= ClockService::DEFAULTER_TIME
            );

        if (! $isVisible) {
            return response()->json([
                'success' => true,
                'targetDate' => $targetDate,
                'virtualTime' => $current->format('H:i:s'),
                'isDefaulterListVisible' => false,
                'count' => 0,
                'defaulters' => [],
            ]);
        }

        $query = Attendance::with([
            'student.user',
            'student.hostel',
            'student.room',
            'markedBy',
        ])
            ->whereDate('attendance_date', $targetDate)
            ->where(function (Builder $query) {
                $query->where('is_defaulter', true)
                    ->orWhere('status', 'absent');
            });

        $role = strtolower(str_replace(
            ' ',
            '_',
            $request->user()->role?->name ?? ''
        ));

        if ($role === 'residential_warden') {
            abort_unless($request->user()->hostel_id, 403, 'No hostel assigned.');

            $query->whereHas('student', function (Builder $studentQuery) use ($request) {
                $studentQuery->where('hostel_id', $request->user()->hostel_id);
            });
        } elseif ($role === 'student') {
            abort(403, 'Students cannot access the defaulter list.');
        } elseif (! in_array($role, [
            'admin',
            'chief_warden',
            'director',
            'caretaker_operator',
        ], true)) {
            abort(403, 'Unauthorized access.');
        }

        if (! empty($validated['hostelId'])) {
            $hostelId = $validated['hostelId'];

            $query->whereHas('student', function (Builder $studentQuery) use ($hostelId) {
                if (ctype_digit($hostelId)) {
                    $studentQuery->where('hostel_id', (int) $hostelId);
                } else {
                    $aliases = [
                        'h-shivalik' => ['Boys Hostel 1', 'Shivalik', 'BH1'],
                        'h-mandakini' => ['Girls Hostel', 'Mandakini', 'GH'],
                        'h-nilgiri' => ['Boys Hostel 2', 'Nilgiri', 'BH2'],
                    ];

                    $studentQuery->whereHas('hostel', function (Builder $hostelQuery) use ($hostelId, $aliases) {
                        $hostelQuery->where('code', $hostelId);

                        if (isset($aliases[$hostelId])) {
                            $hostelQuery->orWhereIn('name', $aliases[$hostelId]);
                        }
                    });
                }
            });
        }

        $records = $query->get();

        return response()->json([
            'success' => true,
            'targetDate' => $targetDate,
            'virtualTime' => $current->format('H:i:s'),
            'isDefaulterListVisible' => true,
            'count' => $records->count(),
            'defaulters' => $records->map(
                fn (Attendance $attendance) => $this->formatRecord($attendance)
            )->values(),
        ]);
    }

    /**
     * List late punches for a date.
     */
    public function latePunches(Request $request)
    {
        $current = $this->clock();

        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'hostelId' => ['nullable', 'string', 'max:100'],
        ]);

        $targetDate = $validated['date'] ?? $current->toDateString();

        $query = Attendance::with([
            'student.user',
            'student.hostel',
            'student.room',
            'markedBy',
        ])
            ->whereDate('attendance_date', $targetDate)
            ->where('status', 'late');

        $role = strtolower(str_replace(
            ' ',
            '_',
            $request->user()->role?->name ?? ''
        ));

        if ($role === 'residential_warden') {
            abort_unless($request->user()->hostel_id, 403, 'No hostel assigned.');

            $query->whereHas('student', function (Builder $studentQuery) use ($request) {
                $studentQuery->where('hostel_id', $request->user()->hostel_id);
            });
        } elseif ($role === 'student') {
            $student = $request->user()->student;

            abort_unless($student, 403, 'Student profile not found.');

            $query->where('student_id', $student->id);
        } elseif (! in_array($role, [
            'admin',
            'chief_warden',
            'director',
            'caretaker_operator',
        ], true)) {
            abort(403, 'Unauthorized access.');
        }

        if (! empty($validated['hostelId'])) {
            $hostelId = $validated['hostelId'];

            $query->whereHas('student', function (Builder $studentQuery) use ($hostelId) {
                if (ctype_digit($hostelId)) {
                    $studentQuery->where('hostel_id', (int) $hostelId);
                } else {
                    $aliases = [
                        'h-shivalik' => ['Boys Hostel 1', 'Shivalik', 'BH1'],
                        'h-mandakini' => ['Girls Hostel', 'Mandakini', 'GH'],
                        'h-nilgiri' => ['Boys Hostel 2', 'Nilgiri', 'BH2'],
                    ];

                    $studentQuery->whereHas('hostel', function (Builder $hostelQuery) use ($hostelId, $aliases) {
                        $hostelQuery->where('code', $hostelId);

                        if (isset($aliases[$hostelId])) {
                            $hostelQuery->orWhereIn('name', $aliases[$hostelId]);
                        }
                    });
                }
            });
        }

        $records = $query->get();

        return response()->json([
            'success' => true,
            'targetDate' => $targetDate,
            'virtualTime' => $current->format('H:i:s'),
            'count' => $records->count(),
            'latePunches' => $records->map(
                fn (Attendance $attendance) => $this->formatRecord($attendance)
            )->values(),
        ]);
    }

    /**
     * Record a manual attendance punch.
     * This endpoint is not a biometric device integration.
     */
    public function recordPunch(Request $request)
    {
        $user = $request->user();

        $role = strtolower(str_replace(' ', '_', $user->role?->name ?? ''));

        abort_unless(in_array($role, [
            'admin',
            'residential_warden',
            'chief_warden',
            'director',
            'caretaker_operator',
        ], true), 403, 'You are not authorized to record attendance.');

        $validated = $request->validate([
            'student_id' => ['required', 'integer', 'exists:students,id'],
            'punchTime' => ['nullable', 'date_format:H:i:s'],
        ]);

        $current = $this->clock();

        $punchTime = $validated['punchTime']
            ?? $current->format('H:i:s');

        $student = Student::findOrFail($validated['student_id']);

        if ($role === 'residential_warden') {
            abort_unless($user->hostel_id, 403, 'No hostel assigned.');

            abort_unless(
                (int) $student->hostel_id === (int) $user->hostel_id,
                403,
                'You cannot record attendance for another hostel student.'
            );
        }

        $date = $current->toDateString();

        $approvedLeave = Leave::where('student_id', $student->id)
            ->where('approval_status', 'approved')
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->exists();

        abort_if(
            $approvedLeave,
            422,
            'Attendance punch cannot be recorded during approved leave.'
        );

        $status = $punchTime <= ClockService::CUTOFF_TIME
            ? 'present'
            : 'late';

        $attendance = DB::transaction(function () use (
            $student,
            $user,
            $date,
            $punchTime,
            $status
        ) {
            $attendance = Attendance::updateOrCreate(
                [
                    'student_id' => $student->id,
                    'attendance_date' => $date,
                ],
                [
                    'marked_by' => $user->id,
                    'punch_time' => $punchTime,
                    'status' => $status,
                    'is_defaulter' => false,
                    'remarks' => 'Manual attendance entry.',
                ]
            );

            Audit::create([
                'user_id' => $user->id,
                'activity' => 'attendance.manual_punch',
                'entity_type' => 'attendance',
                'entity_id' => (string) $attendance->id,
                'details' => json_encode([
                    'student_id' => $student->id,
                    'punch_time' => $punchTime,
                    'status' => $status,
                    'date' => $date,
                ], JSON_UNESCAPED_UNICODE),
                'activity_at' => app(ClockService::class)->current(),
            ]);

            return $attendance;
        });

        $attendance->load([
            'student.user',
            'student.hostel',
            'student.room',
            'markedBy',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Manual attendance recorded successfully.',
            'record' => $this->formatRecord($attendance),
        ], 201);
    }

    public function history(Request $request)
    {
        $records = $this->filteredQuery($request)->get();

        return response()->json([
            'success' => true,
            'totalRecords' => $records->count(),
            'records' => $records->map(
                fn (Attendance $attendance) => $this->formatRecord($attendance)
            )->values(),
        ]);
    }

    /**
     * Correct an attendance record and create an audit entry.
     */
    public function correct(Request $request)
    {
        $user = $request->user();
        $role = strtolower(str_replace(' ', '_', $user->role?->name ?? ''));

        abort_unless(
            in_array($role, ['admin', 'residential_warden'], true),
            403,
            'Only Admin or Residential Warden can correct attendance.'
        );

        $validated = $request->validate([
            'recordId' => ['required', 'integer', 'exists:attendances,id'],
            'newStatus' => ['required', 'in:present,late,approved_leave,absent'],
            'reason' => ['required', 'string', 'min:3', 'max:1000'],
        ]);

        $attendance = Attendance::with('student')->findOrFail($validated['recordId']);

        if ($role === 'residential_warden') {
            abort_unless($user->hostel_id, 403, 'No hostel assigned.');

            abort_unless(
                (int) $attendance->student->hostel_id === (int) $user->hostel_id,
                403,
                'You can only correct attendance for your assigned hostel.'
            );
        }

        DB::transaction(function () use ($attendance, $validated, $user) {
            $oldStatus = $attendance->status;
            $oldDefaulter = (bool) $attendance->is_defaulter;

            $attendance->status = $validated['newStatus'];
            $attendance->is_defaulter = $validated['newStatus'] === 'absent';
            $attendance->remarks = $validated['reason'];
            $attendance->marked_by = $user->id;
            $attendance->save();

            Audit::create([
                'user_id' => $user->id,
                'activity' => 'attendance.corrected',
                'entity_type' => 'attendance',
                'entity_id' => (string) $attendance->id,
                'details' => json_encode([
                    'student_id' => $attendance->student_id,
                    'old_status' => $oldStatus,
                    'new_status' => $validated['newStatus'],
                    'old_is_defaulter' => $oldDefaulter,
                    'new_is_defaulter' => (bool) $attendance->is_defaulter,
                    'reason' => $validated['reason'],
                ], JSON_UNESCAPED_UNICODE),
                'activity_at' => $this->clock(),
            ]);
        });

        $attendance->load([
            'student.user',
            'student.hostel',
            'student.room',
            'markedBy',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Attendance corrected and audit log recorded.',
            'record' => $this->formatRecord($attendance),
        ]);
    }

    public function exportAttendance(Request $request): StreamedResponse
    {
        $records = $this->filteredQuery($request)->get();

        return response()->streamDownload(function () use ($records) {
            $output = fopen('php://output', 'w');

            fputcsv($output, [
                'Date',
                'Student Name',
                'Enrollment No',
                'Hostel',
                'Room',
                'Punch Time',
                'Status',
                'Defaulter',
                'Remarks',
            ]);

            foreach ($records as $attendance) {
                $student = $attendance->student;

                fputcsv($output, [
                    $attendance->attendance_date?->format('Y-m-d'),
                    $student->user?->name,
                    $student->enrollment_no,
                    $student->hostel?->name,
                    $student->room?->room_number,
                    $attendance->punch_time,
                    $attendance->status,
                    $attendance->is_defaulter ? 'Yes' : 'No',
                    $attendance->remarks,
                ]);
            }

            fclose($output);
        }, 'attendance.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function exportDefaulters(Request $request): StreamedResponse
    {
        $records = $this->filteredQuery($request)
            ->where(function (Builder $query) {
                $query->where('is_defaulter', true)
                    ->orWhere('status', 'absent');
            })
            ->get();

        return response()->streamDownload(function () use ($records) {
            $output = fopen('php://output', 'w');

            fputcsv($output, [
                'Date',
                'Student Name',
                'Enrollment No',
                'Hostel',
                'Room',
                'Status',
                'Remarks',
            ]);

            foreach ($records as $attendance) {
                $student = $attendance->student;

                fputcsv($output, [
                    $attendance->attendance_date?->format('Y-m-d'),
                    $student->user?->name,
                    $student->enrollment_no,
                    $student->hostel?->name,
                    $student->room?->room_number,
                    $attendance->status,
                    $attendance->remarks,
                ]);
            }

            fclose($output);
        }, 'defaulters.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
