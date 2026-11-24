<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Execution;
use App\Models\ScheduledTask;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Services\AuditService;

class ExecutionController extends Controller
{
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Only Admin can manage executions.',
            ], 403);
        }

        return null;
    }

    // Create execution record
    public function store(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'job_id' => ['required', 'integer', 'exists:scheduled_tasks,id'],
            'started_at' => ['required', 'date'],
            'completed_at' => [
                'nullable',
                'date',
                'after_or_equal:started_at',
            ],
            'status' => [
                'required',
                Rule::in(['running', 'completed', 'failed']),
            ],
            'error_message' => ['nullable', 'string'],
        ]);

        if (
            in_array($data['status'], ['completed', 'failed'], true)
            && empty($data['completed_at'])
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Completed and failed executions must have a completed_at timestamp.',
            ], 422);
        }

        if (
            $data['status'] === 'running'
            && !empty($data['completed_at'])
        ) {
            return response()->json([
                'success' => false,
                'message' => 'A running execution cannot have a completed_at timestamp.',
            ], 422);
        }

        $task = ScheduledTask::findOrFail($data['job_id']);

        if (!$task->is_active) {
            return response()->json([
                'message' => 'This scheduled task is inactive.',
            ], 422);
        }

        $execution = Execution::create($data);

        app(AuditService::class)->log(
            'Execution Created',
            'Execution',
            $execution->id,
            'Created execution for scheduled task ID ' . $execution->job_id,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Execution record created successfully.',
            'execution' => $execution,
        ], 201);
    }

    // View execution history
    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $filters = $request->validate([
            'job_id' => ['nullable', 'integer', 'exists:scheduled_tasks,id'],
        ]);

        $query = Execution::with('scheduledTask', 'evaluations')
            ->orderByDesc('created_at');

        if (!empty($filters['job_id'])) {
            $query->where('job_id', $filters['job_id']);
        }

        return response()->json($query->get());
    }

    // View single execution
    public function show(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $execution = Execution::with(
            'scheduledTask',
            'evaluations'
        )->findOrFail($id);

        return response()->json($execution);
    }

    // Update execution record
    public function update(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $execution = Execution::findOrFail($id);

        $data = $request->validate([
            'completed_at' => [
                'sometimes',
                'nullable',
                'date',
                'after_or_equal:' . $execution->started_at,
            ],
            'status' => [
                'sometimes',
                Rule::in(['running', 'completed', 'failed']),
            ],
            'error_message' => ['sometimes', 'nullable', 'string'],
        ]);

        // Terminal execution statuses cannot be changed.
        if (
            in_array($execution->status, ['completed', 'failed'], true)
            && isset($data['status'])
            && $data['status'] !== $execution->status
        ) {
            return response()->json([
                'success' => false,
                'message' => 'A completed or failed execution cannot be restarted or moved to another status.',
            ], 422);
        }

        $newStatus = $data['status'] ?? $execution->status;
        $newCompletedAt = array_key_exists('completed_at', $data)
            ? $data['completed_at']
            : $execution->completed_at;

        if (
            in_array($newStatus, ['completed', 'failed'], true)
            && empty($newCompletedAt)
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Completed and failed executions must have a completed_at timestamp.',
            ], 422);
        }

        if (
            $newStatus === 'running'
            && !empty($newCompletedAt)
        ) {
            return response()->json([
                'success' => false,
                'message' => 'A running execution cannot have a completed_at timestamp.',
            ], 422);
        }

        $execution->update($data);

        app(AuditService::class)->log(
            'Execution Updated',
            'Execution',
            $execution->id,
            'Updated execution record. Current status: ' . $execution->status,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Execution updated successfully.',
            'execution' => $execution->fresh(),
        ]);
    }
}
