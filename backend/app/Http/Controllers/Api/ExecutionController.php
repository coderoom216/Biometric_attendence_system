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
                'message' => 'Only Admin can manage executions.'
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
            'job_id' => ['required', 'exists:scheduled_tasks,id'],
            'started_at' => ['required', 'date'],
            'completed_at' => ['nullable', 'date', 'after_or_equal:started_at'],
            'status' => [
                'required',
                Rule::in(['running', 'completed', 'failed'])
            ],
            'error_message' => ['nullable', 'string'],
        ]);

        $task = ScheduledTask::findOrFail($data['job_id']);

        if (!$task->is_active) {
            return response()->json([
                'message' => 'This scheduled task is inactive.'
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

        $query = Execution::with('scheduledTask', 'evaluations')
            ->orderByDesc('created_at');

        if ($request->filled('job_id')) {
            $query->where('job_id', $request->job_id);
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
                'after_or_equal:' . $execution->started_at
            ],
            'status' => [
                'sometimes',
                Rule::in(['running', 'completed', 'failed'])
            ],
            'error_message' => ['sometimes', 'nullable', 'string'],
        ]);

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
            'execution' => $execution,
        ]);
    }
}
