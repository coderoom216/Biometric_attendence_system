<?php

use App\Services\ClockService;
use App\Services\DefaulterEvaluationService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Automatic Attendance Defaulter Evaluation
|--------------------------------------------------------------------------
|
| Runs daily at 10:00 PM Indian Standard Time.
| Uses the shared ClockService date, including virtual dates.
|
*/

Artisan::command(
    'attendance:evaluate-defaulters',
    function (
        DefaulterEvaluationService $evaluationService,
        ClockService $clockService
    ) {
        try {
            // Preserve the shared clock date, but evaluate at 10 PM.
            $target = $clockService->current()
                ->setTime(22, 0, 0);

            $summary = $evaluationService->evaluate(
                $target,
                true
            );

            $this->info('Attendance defaulter evaluation completed.');

            $this->table(
                ['Metric', 'Count'],
                [
                    ['Date evaluated', $summary['dateEvaluated']],
                    ['Total students', $summary['totalStudents']],
                    ['Present', $summary['presentCount']],
                    ['Late', $summary['lateCount']],
                    ['Approved leave', $summary['leaveCount']],
                    ['Defaulters', $summary['defaultersCount']],
                    ['Tokens issued', $summary['tokensIssued']],
                    ['Notifications queued', $summary['notificationsQueued']],
                ]
            );

            return 0;
        } catch (\Throwable $exception) {
            report($exception);

            $this->error(
                'Attendance evaluation failed: ' . $exception->getMessage()
            );

            return 1;
        }
    }
)->purpose('Evaluate attendance and issue automatic 10 PM defaulter tokens');

/*
|--------------------------------------------------------------------------
| Daily Schedule
|--------------------------------------------------------------------------
*/

Schedule::command('attendance:evaluate-defaulters')
    ->dailyAt('22:00')
    ->timezone('Asia/Kolkata')
    ->withoutOverlapping();
