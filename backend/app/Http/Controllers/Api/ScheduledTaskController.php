<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ScheduledTask;
use Illuminate\Http\Request;
use App\Services\AuditService;

class ScheduledTaskController extends Controller
{
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Only Admin can manage scheduled tasks.'
            ], 403);
        }

        return null;
    }

    // Create scheduled task
    public function store(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'schedule' => ['required', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $task = ScheduledTask::create($data);
                app(AuditService::class)->log(
            'Scheduled Task Created',
            'ScheduledTask',
            $task->id,
            'Created scheduled task: ' . $task->name,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Scheduled task created successfully.',
            'task' => $task,
        ], 201);
    }

    // View all scheduled tasks
    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        return response()->json(
            ScheduledTask::with('executions')->latest()->get()
        );
    }

    // Update scheduled task
    public function update(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $task = ScheduledTask::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'schedule' => ['sometimes', 'required', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $task->update($data);
                app(AuditService::class)->log(
            'Scheduled Task Updated',
            'ScheduledTask',
            $task->id,
            'Updated scheduled task: ' . $task->name,
            $request->user()->id
        );
        return response()->json([
            'message' => 'Scheduled task updated successfully.',
            'task' => $task,
        ]);
    }

    // Delete scheduled task
    public function destroy(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $task = ScheduledTask::findOrFail($id);

        app(AuditService::class)->log(
            'Scheduled Task Deleted',
            'ScheduledTask',
            $task->id,
            'Deleted scheduled task: ' . $task->name,
            $request->user()->id
        );

        $task->delete();        $task->delete();

        return response()->json([
            'message' => 'Scheduled task deleted successfully.'
        ]);
    }
}
