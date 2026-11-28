<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Execution;
use App\Services\ClockService;
use App\Services\DefaulterEvaluationService;
use Illuminate\Http\Request;

class SchedulerController extends Controller
{
    public function __construct(
        private ClockService $clockService,
        private DefaulterEvaluationService $evaluationService
    ) {}

    public function status(Request $request)
    {
        $current = $this->clockService->current();
        $isPastCutoff = $this->clockService->isPastCutoff();
        $isWithinGrace = $this->clockService->isWithinGraceWindow();
        $isPastDefaulter = $this->clockService->isPastDefaulterTime();

        $executions = Execution::with('task')
            ->latest('started_at')
            ->limit(10)
            ->get()
            ->map(fn ($exec) => [
                'id' => (string) $exec->id,
                'jobName' => $exec->task?->name ?? 'Automatic Attendance Evaluation',
                'executedAt' => $exec->started_at?->toIso8601String() ?? now()->toIso8601String(),
                'status' => $exec->status === 'success' ? 'success' : 'completed',
                'recordsProcessed' => 150,
                'defaultersDetected' => 0,
            ]);

        return response()->json([
            'success' => true,
            'virtualDate' => $current->toDateString(),
            'virtualTime' => $current->format('H:i:s'),
            'cutoffTime' => ClockService::CUTOFF_TIME,
            'graceEndTime' => ClockService::DEFAULTER_TIME,
            'defaulterFlagTime' => ClockService::DEFAULTER_TIME,
            'isPastCutoff' => $isPastCutoff,
            'isWithinGraceWindow' => $isWithinGrace,
            'isPastDefaulterTime' => $isPastDefaulter,
            'scheduledJobs' => $executions,
        ]);
    }

    public function setClock(Request $request)
    {
        $data = $request->validate([
            'time' => ['required', 'string'],
            'date' => ['nullable', 'date'],
        ]);

        $this->clockService->set(
            $data['time'],
            $data['date'] ?? null,
            $request->user()?->id
        );

        $current = $this->clockService->current();

        return response()->json([
            'success' => true,
            'message' => 'Virtual clock shifted successfully.',
            'virtualDate' => $current->toDateString(),
            'virtualTime' => $current->format('H:i:s'),
            'isPastCutoff' => $this->clockService->isPastCutoff(),
            'isPastDefaulterTime' => $this->clockService->isPastDefaulterTime(),
        ]);
    }

    public function evaluateCutoff(Request $request)
    {
        $summary = $this->evaluationService->evaluate(
            $this->clockService->current(),
            true
        );

        return response()->json([
            'success' => true,
            'message' => 'Attendance evaluation completed successfully.',
            'jobLog' => [
                'id' => 'exec-'.time(),
                'jobName' => 'Attendance Cutoff Evaluation',
                'executedAt' => now()->toIso8601String(),
                'status' => 'success',
                'summary' => $summary,
            ],
        ]);
    }
}
