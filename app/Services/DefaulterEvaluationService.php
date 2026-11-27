<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Audit;
use App\Models\Blacklist;
use App\Models\Device;
use App\Models\Leave;
use App\Models\Punch;
use App\Models\Student;
use App\Models\Token;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use MongoDB\Driver\Manager;
use MongoDB\Driver\Query;
use RuntimeException;

class DefaulterEvaluationService
{
    private const TOKEN_REASON = 'Automatic 10 PM defaulter token';

    public function __construct(
        private ClockService $clockService,
        private AlertService $alertService,
        private SemesterService $semesterService
    ) {}

    /**
     * Ensure attendance defaulter evaluation has run when the 10:00 PM IST window has passed.
     */
    public function ensureEvaluatedForDate(string $targetDate): void
    {
        try {
            $parsedTarget = Carbon::createFromFormat('Y-m-d', $targetDate, ClockService::TIMEZONE);
        } catch (\Throwable) {
            return;
        }

        if (! $parsedTarget) {
            return;
        }

        $now = $this->clockService->current();
        $today = $now->toDateString();

        if ($targetDate > $today) {
            return;
        }

        $this->syncApprovedLeavesForDate($targetDate);

        if ($this->semesterService->holidayForDate($targetDate) !== null) {
            return;
        }

        if ($targetDate < $now->copy()->subDays(7)->toDateString()) {
            return;
        }

        if (! app()->runningUnitTests()) {
            $this->syncMongoPunchesIfNeeded($targetDate);
        }

        if ($targetDate === $today && $now->format('H:i:s') < ClockService::DEFAULTER_TIME) {
            return;
        }

        $cutoffUtc = Carbon::parse($targetDate.' 23:59:59', ClockService::TIMEZONE)
            ->setTimezone(config('app.timezone', 'UTC'));

        $needsEvaluation = Student::query()
            ->verified()
            ->where('created_at', '<=', $cutoffUtc)
            ->whereDoesntHave('attendances', function ($query) use ($targetDate) {
                $query->whereDate('attendance_date', $targetDate);
            })
            ->exists();

        if (! $needsEvaluation) {
            $needsEvaluation = Attendance::query()
                ->whereDate('attendance_date', $targetDate)
                ->whereNotNull('punch_time')
                ->where('punch_time', '>', ClockService::DEFAULTER_TIME)
                ->where('is_defaulter', false)
                ->exists();
        }

        if (! $needsEvaluation) {
            return;
        }

        $evalAt = Carbon::parse($targetDate.' '.ClockService::DEFAULTER_TIME, ClockService::TIMEZONE);

        try {
            Cache::lock("defaulter-auto-eval:{$targetDate}", 15)->block(5, function () use ($evalAt) {
                $this->evaluate($evalAt, true);
            });
        } catch (\Throwable) {
            $this->evaluate($evalAt, true);
        }
    }

    /**
     * Ensure approved leaves for $targetDate are reflected in attendance rows even prior to 10 PM evaluation.
     */
    private function syncApprovedLeavesForDate(string $targetDate): void
    {
        $approvedLeaves = Leave::query()
            ->where('approval_status', 'approved')
            ->whereDate('start_date', '<=', $targetDate)
            ->whereDate('end_date', '>=', $targetDate)
            ->get();

        foreach ($approvedLeaves as $leave) {
            $existing = Attendance::query()
                ->where('student_id', $leave->student_id)
                ->whereDate('attendance_date', $targetDate)
                ->first();

            if ($existing && $existing->status === 'approved_leave' && ! $existing->is_defaulter) {
                continue;
            }

            Attendance::updateOrCreate(
                [
                    'student_id' => $leave->student_id,
                    'attendance_date' => $targetDate,
                ],
                [
                    'marked_by' => $leave->approved_by,
                    'status' => 'approved_leave',
                    'is_defaulter' => false,
                    'remarks' => 'Approved leave (Gate Pass: '.$leave->gate_pass_no.').',
                ]
            );
        }
    }

    /**
     * Invalidate the cached MongoDB punch marker and force-sync punches for a specific date.
     */
    public function invalidateAndSyncForDate(string $targetDate): void
    {
        Cache::forget("mongo-last-glog-id:{$targetDate}");

        if (! app()->runningUnitTests()) {
            $this->syncMongoPunchesForDate($targetDate);
        }
    }

    /**
     * Check MongoDB's latest glog_data ID for $targetDate and sync immediately when a new punch arrives.
     */
    private function syncMongoPunchesIfNeeded(string $targetDate): void
    {
        try {
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new Manager($mongoUri);
            $latestQuery = new Query(
                ['io_time' => ['$regex' => '^'.preg_quote($targetDate, '/')]],
                ['sort' => ['id' => -1], 'limit' => 1, 'projection' => ['id' => 1]]
            );
            $latestDocs = iterator_to_array($manager->executeQuery('biometric_db.glog_data', $latestQuery));
            if (empty($latestDocs)) {
                return;
            }

            $latestId = (string) ($latestDocs[0]->id ?? ($latestDocs[0]->_id ?? ''));
            $cacheKey = "mongo-last-glog-id:{$targetDate}";
            $cachedId = Cache::get($cacheKey);

            if ($latestId !== '' && $cachedId === $latestId) {
                return;
            }

            $this->syncMongoPunchesForDate($targetDate);

            if ($latestId !== '') {
                Cache::put($cacheKey, $latestId, 3600);
            }
        } catch (\Throwable) {
            $this->syncMongoPunchesForDate($targetDate);
        }
    }

    /**
     * Sync biometric punches from MongoDB glog_data for a given date before defaulter evaluation.
     */
    public function syncMongoPunchesForDate(string $targetDate): void
    {
        try {
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new Manager($mongoUri);
            $glogQuery = new Query(
                ['io_time' => ['$regex' => '^'.preg_quote($targetDate, '/')]],
                ['sort' => ['id' => 1], 'limit' => 500]
            );
            $records = iterator_to_array($manager->executeQuery('biometric_db.glog_data', $glogQuery));
            if (empty($records)) {
                return;
            }

            $students = Student::query()->get();
            $studentsByBioId = [];
            foreach ($students as $student) {
                $raw = trim((string) $student->biometric_id);
                if ($raw === '') {
                    continue;
                }
                $clean = ltrim($raw, '0') ?: $raw;
                $studentsByBioId[$raw] = $student;
                $studentsByBioId[$clean] = $student;
            }

            $devicesBySerial = Device::query()->get()->keyBy('device_serial');
            $syncedStudentIds = [];

            foreach ($records as $record) {
                $bioId = trim((string) ($record->user_id ?? ''));
                $cleanId = ltrim($bioId, '0') ?: $bioId;
                $student = $studentsByBioId[$bioId] ?? ($studentsByBioId[$cleanId] ?? null);
                if (! $student || empty($record->io_time)) {
                    continue;
                }

                $punchAt = Carbon::parse($record->io_time, ClockService::TIMEZONE);
                $matchedDev = $devicesBySerial->get($record->dev_id ?? '');

                Punch::firstOrCreate(
                    [
                        'student_id' => $student->id,
                        'punched_at' => $punchAt,
                    ],
                    [
                        'device_id' => $matchedDev?->id ?? 1,
                        'synced_at' => now(),
                    ]
                );

                if (isset($syncedStudentIds[$student->id])) {
                    continue;
                }
                $syncedStudentIds[$student->id] = true;

                $existing = Attendance::query()
                    ->where('student_id', $student->id)
                    ->whereDate('attendance_date', $punchAt->toDateString())
                    ->first();

                if (
                    $existing &&
                    $existing->punch_time !== null &&
                    (string) $existing->punch_time <= $punchAt->toTimeString()
                ) {
                    continue;
                }

                $classification = ClockService::classifyPunchTime($punchAt->format('H:i:s'));
                Attendance::updateOrCreate(
                    [
                        'student_id' => $student->id,
                        'attendance_date' => $punchAt->toDateString(),
                    ],
                    [
                        'punch_time' => $punchAt->toTimeString(),
                        'status' => $classification['status'],
                        'is_defaulter' => $classification['is_defaulter'],
                        'remarks' => $classification['is_defaulter']
                            ? 'Biometric punch recorded after 10:00 PM IST (defaulter).'
                            : ($classification['status'] === 'late'
                                ? 'Biometric late punch (19:30 - 22:00 IST).'
                                : 'Biometric machine punch'),
                    ]
                );
            }
        } catch (\Throwable $e) {
            \Log::warning('MongoDB punch sync skipped before defaulter evaluation: '.$e->getMessage());
        }
    }

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
        $holiday = $this->semesterService->holidayForDate($date);
        if ($holiday !== null) {
            return [
                'dateEvaluated' => $date,
                'isHoliday' => true,
                'holidayReason' => $holiday->reason,
                'totalStudents' => 0,
                'presentCount' => 0,
                'lateCount' => 0,
                'leaveCount' => 0,
                'defaultersCount' => 0,
                'tokensIssued' => 0,
                'notificationsQueued' => 0,
            ];
        }

        $semester = $this->semesterService->active();
        $monthStart = $current->copy()->startOfMonth()->toDateString();
        $targetCutoffUtc = Carbon::parse($date.' 23:59:59', ClockService::TIMEZONE)
            ->setTimezone(config('app.timezone', 'UTC'));

        return DB::transaction(function () use ($current, $date, $monthStart, $semester, $targetCutoffUtc) {
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
                ->where('created_at', '<=', $targetCutoffUtc)
                ->orderBy('id')
                ->chunkById(100, function ($students) use (
                    $current,
                    $date,
                    $monthStart,
                    $semester,
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

                        // Preserve a recorded punch and classify it by 19:30 late window & 22:00 defaulter cutoff.
                        if ($attendance && $attendance->punch_time) {
                            $classification = ClockService::classifyPunchTime($attendance->punch_time);
                            $status = $classification['status'];
                            $isDefaulter = $classification['is_defaulter'];

                            if (
                                $attendance->status !== $status ||
                                (bool) $attendance->is_defaulter !== $isDefaulter
                            ) {
                                $attendance->update([
                                    'status' => $status,
                                    'is_defaulter' => $isDefaulter,
                                    'remarks' => $isDefaulter
                                        ? 'Punch recorded after 10:00 PM IST (defaulter).'
                                        : $attendance->remarks,
                                ]);
                            }

                            if ($isDefaulter) {
                                $summary['defaultersCount']++;
                            } elseif ($status === 'present') {
                                $summary['presentCount']++;

                                continue;
                            } else {
                                $summary['lateCount']++;

                                continue;
                            }
                        }

                        // Do not turn an already recorded present/late entry
                        // into a defaulter if it has no punch_time.
                        if (
                            ! ($attendance && $attendance->punch_time)
                            && $attendance
                            && in_array($attendance->status, ['present', 'late'], true)
                        ) {
                            $summary[$attendance->status === 'present'
                                ? 'presentCount'
                                : 'lateCount']++;

                            continue;
                        }

                        if (! ($attendance && $attendance->punch_time)) {
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
                        }

                        if ($date < $semester['startDate'] || $date > $semester['endDate']) {
                            continue;
                        }

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

                        // Recalculate active semester total after issuing the token.
                        $semesterTotal = Token::query()
                            ->where('student_id', $student->id)
                            ->whereDate('issued_date', '>=', $semester['startDate'])
                            ->whereDate('issued_date', '<=', $semester['endDate'])
                            ->sum('token_count');

                        $this->alertService->checkStudentAlerts($student, $current);

                        // Blacklist only after semester total exceeds 10.
                        if ($semesterTotal > 10) {
                            $blacklist = Blacklist::firstOrNew([
                                'student_id' => $student->id,
                                'month_start' => $semester['startDate'],
                            ]);

                            $blacklist->total_tokens = $semesterTotal;
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
                                'semester_total' => $semesterTotal,
                                'blacklisted' => $semesterTotal > 10,
                            ], JSON_UNESCAPED_UNICODE),
                            'activity_at' => $current,
                        ]);
                    }
                });

            return $summary;
        }, 3);
    }
}
