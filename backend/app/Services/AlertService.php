<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\AlertTier;
use App\Models\Student;
use App\Models\Token;

class AlertService
{
    public function checkStudentAlerts(Student $student): void
    {
        $monthStart = now()->startOfMonth()->toDateString();

        $monthEnd = now()->endOfMonth()->toDateString();

        // Calculate student's total tokens for this month
        $totalTokens = Token::where('student_id', $student->id)
            ->where('month_start', $monthStart)
            ->sum('token_count');

        // Get configured alert thresholds
        $tiers = AlertTier::orderBy('threshold')->get();

        foreach ($tiers as $tier) {

            if ($totalTokens < $tier->threshold) {
                continue;
            }

            // Prevent duplicate alerts for the same tier and month
            $alreadyExists = Alert::where('student_id', $student->id)
                ->where('tier_id', $tier->id)
                ->whereBetween('triggered_at', [
                    $monthStart,
                    $monthEnd.' 23:59:59',
                ])
                ->exists();

            if (! $alreadyExists) {
                Alert::create([
                    'student_id' => $student->id,
                    'tier_id' => $tier->id,
                    'alert_type' => $tier->tier_name,
                    'alert_status' => 'active',
                    'triggered_at' => now(),
                ]);
            }
        }
    }
}
