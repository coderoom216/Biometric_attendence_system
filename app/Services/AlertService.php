<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\AlertTier;
use App\Models\Notification;
use App\Models\Role;
use App\Models\Student;
use App\Models\Token;
use App\Models\User;
use Carbon\Carbon;

class AlertService
{
    public function __construct(
        private ClockService $clockService,
        private SemesterService $semesterService
    ) {}

    public function checkStudentAlerts(Student $student, ?Carbon $evaluatedAt = null): void
    {
        $current = $evaluatedAt
            ? $evaluatedAt->copy()->setTimezone(ClockService::TIMEZONE)
            : $this->clockService->current();

        $semester = $this->semesterService->active();
        $semesterStart = $semester['startDate'];
        $semesterEnd = $semester['endDate'];

        $totalTokens = Token::where('student_id', $student->id)
            ->whereDate('issued_date', '>=', $semesterStart)
            ->whereDate('issued_date', '<=', $semesterEnd)
            ->sum('token_count');

        $tiers = AlertTier::orderBy('threshold')->get();

        foreach ($tiers as $tier) {
            if ($totalTokens < $tier->threshold) {
                continue;
            }

            $alreadyExists = Alert::where('student_id', $student->id)
                ->where('tier_id', $tier->id)
                ->whereBetween('triggered_at', [
                    $semesterStart.' 00:00:00',
                    $semesterEnd.' 23:59:59',
                ])
                ->exists();

            if (! $alreadyExists) {
                $alert = Alert::create([
                    'student_id' => $student->id,
                    'tier_id' => $tier->id,
                    'alert_type' => $tier->tier_name,
                    'alert_status' => 'active',
                    'triggered_at' => $current,
                ]);

                $this->dispatchSequentialNotifications($alert, $student);
            }
        }
    }

    public function dispatchSequentialNotifications(Alert $alert, Student $student): int
    {
        $student->loadMissing(['user', 'hostel']);
        $recipients = [];

        // Tier 1: Residential Warden
        $rw = User::where('hostel_id', $student->hostel_id)
            ->whereHas('role', fn ($q) => $q->where('name', Role::RESIDENTIAL_WARDEN))
            ->first();
        if ($rw?->email) {
            $recipients[] = ['role' => 'Residential Warden', 'email' => $rw->email];
        }

        // Tier 2: Warden
        $warden = User::where('hostel_id', $student->hostel_id)
            ->whereHas('role', fn ($q) => $q->where('name', 'Warden'))
            ->first();
        if ($warden?->email) {
            $recipients[] = ['role' => 'Warden', 'email' => $warden->email];
        }

        // Tier 3: Chief Warden
        $cw = User::whereHas('role', fn ($q) => $q->where('name', Role::CHIEF_WARDEN))->first();
        if ($cw?->email) {
            $recipients[] = ['role' => 'Chief Warden', 'email' => $cw->email];
        }

        // Tier 4: Director
        $director = User::whereHas('role', fn ($q) => $q->where('name', Role::DIRECTOR))->first();
        if ($director?->email) {
            $recipients[] = ['role' => 'Director', 'email' => $director->email];
        }

        // Tier 5: Student Parents / Guardian
        if (! empty($student->parent_email)) {
            $recipients[] = ['role' => 'Parent', 'email' => $student->parent_email];
        }

        // Tier 6: The Student
        if ($student->user?->email) {
            $recipients[] = ['role' => 'Student', 'email' => $student->user->email];
        }

        $count = 0;
        foreach ($recipients as $item) {
            Notification::create([
                'alert_id' => $alert->id,
                'channel' => 'Email',
                'recipient' => $item['email'],
                'delivery_status' => 'queued',
                'sent_at' => now(),
            ]);
            $count++;
        }

        return $count;
    }
}
