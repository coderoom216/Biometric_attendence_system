<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Audit;
use App\Models\Blacklist;
use App\Models\Leave;
use App\Models\Student;
use App\Models\Token;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DefaulterEvaluationService
{
    private const TOKEN_REASON = 'Automatic 10 PM defaulter token';

    public function __construct(
        private ClockService $clockService,
        private AlertService $alertService
    ) {}

    /**
     * Evaluate all students for the selected date.
     *
     * $force is reserved for the actual scheduled command.
     * Manual API evaluation must not bypass the 10 PM check.
     */
    public function evaluate(?Carbon $target = null, bool $force = false): array
    {
        $current = $target
            ? $target->copy()->setTimezone(ClockService::TIMEZONE)
            : $this->clockService->current();

        if (
            ! $force &&
            $current->format('H:i:s') < ClockService::DEFAULTER_TIME
        ) {
            throw new RuntimeException(
                'Defaulter evaluation is available only at or after 10:00 PM IST.'
            );
        }

        $date = $current->toDateString();
        $monthStart = $current->copy()->startOfMonth()->toDateString();

        return DB::transaction(function () use ($current, $date, $monthStart) {
            $summary = [
                'dateEvaluated' => $date,
                'totalStudents' => 0,
                'presentCount' => 0,
                'lateCount' => 0,
                'leaveCount' => 0,
                'defaultersCount' => 0,
                'tokensIssued' => 0,
                'notificationsQueued' => 0,
            ];

            Student::query()
                ->verified()
                ->orderBy('id')
                ->chunkById(100, function ($students) use (
                    $current,
                    $date,
                    $monthStart,
                    &$summary
                ) {
                    foreach ($students as $studentRow) {
                        $student = Student::query()
                            ->whereKey($studentRow->id)
                            ->lockForUpdate()
                            ->first();

                        if (! $student) {
                            continue;
                        }

                        $summary['totalStudents']++;

                        $attendance = Attendance::query()
                            ->where('student_id', $student->id)
                            ->whereDate('attendance_date', $date)
                            ->lockForUpdate()
                            ->first();

                        $approvedLeave = Leave::query()
                            ->where('student_id', $student->id)
                            ->where('approval_status', 'approved')
                            ->whereDate('start_date', '<=', $date)
                            ->whereDate('end_date', '>=', $date)
                            ->exists();

                        // Approved leave takes priority over absence.
                        if ($approvedLeave) {
                            Attendance::updateOrCreate(
                                [
                                    'student_id' => $student->id,
                                    'attendance_date' => $date,
                                ],
                                [
                                    'marked_by' => null,
                                    'status' => 'approved_leave',
                                    'is_defaulter' => false,
                                    'remarks' => 'Approved leave.',
                                ]
                            );

                            $summary['leaveCount']++;

                            continue;
                        }

                        // Preserve a recorded punch and classify it by cutoff.
                        if ($attendance && $attendance->punch_time) {
                            $status = $attendance->punch_time
                                <= ClockService::CUTOFF_TIME
                                ? 'present'
                                : 'late';

                            if (
                                $attendance->status !== $status ||
                                $attendance->is_defaulter
                            ) {
                                $attendance->update([
                                    'status' => $status,
                                    'is_defaulter' => false,
                                ]);
                            }

                            if ($status === 'present') {
                                $summary['presentCount']++;
                            } else {
                                $summary['lateCount']++;
                            }

                            continue;
                        }

                        // Do not turn an already recorded present/late entry
                        // into a defaulter if it has no punch_time.
                        if (
                            $attendance &&
                            in_array($attendance->status, ['present', 'late'], true)
                        ) {
                            $summary[$attendance->status === 'present'
                                ? 'presentCount'
                                : 'lateCount']++;

                            continue;
                        }

                        // No punch and no approved leave: mark as defaulter.
                        $attendance = Attendance::updateOrCreate(
                            [
                                'student_id' => $student->id,
                                'attendance_date' => $date,
                            ],
                            [
                                'marked_by' => null,
                                'status' => 'absent',
                                'is_defaulter' => true,
                                'remarks' => 'Automatically marked absent during 10 PM evaluation.',
                            ]
                        );

                        $summary['defaultersCount']++;

                        // Idempotency: one automatic token per student/date.
                        $tokenExists = Token::query()
                            ->where('student_id', $student->id)
                            ->whereDate('issued_date', $date)
                            ->where('reason', self::TOKEN_REASON)
                            ->exists();

                        if ($tokenExists) {
                            continue;
                        }

                        Token::create([
                            'student_id' => $student->id,
                            'issued_by' => null,
                            'token_count' => 1,
                            'reason' => self::TOKEN_REASON,
                            'issued_date' => $date,
                            'month_start' => $monthStart,
                        ]);

                        $summary['tokensIssued']++;

                        // Recalculate monthly total after issuing the token.
                        $monthlyTotal = Token::query()
                            ->where('student_id', $student->id)
                            ->whereDate('month_start', $monthStart)
                            ->sum('token_count');

                        $this->alertService->checkStudentAlerts($student);

                        // Blacklist only after monthly total exceeds 10.
                        if ($monthlyTotal > 10) {
                            $blacklist = Blacklist::firstOrNew([
                                'student_id' => $student->id,
                                'month_start' => $monthStart,
                            ]);

                            $blacklist->total_tokens = $monthlyTotal;
                            $blacklist->status = 'active';

                            if (! $blacklist->blacklisted_at) {
                                $blacklist->blacklisted_at = $current;
                            }

                            $blacklist->save();
                        }

                        // System-generated audit entry; no staff user is assigned.
                        Audit::create([
                            'user_id' => null,
                            'activity' => 'attendance.automatic_defaulter_token',
                            'entity_type' => 'token',
                            'entity_id' => null,
                            'details' => json_encode([
                                'student_id' => $student->id,
                                'attendance_id' => $attendance->id,
                                'issued_date' => $date,
                                'token_count' => 1,
                                'monthly_total' => $monthlyTotal,
                                'blacklisted' => $monthlyTotal > 10,
                            ], JSON_UNESCAPED_UNICODE),
                            'activity_at' => $current,
                        ]);
                    }
                });

            return $summary;
        }, 3);
    }
}
