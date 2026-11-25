<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Evaluation;
use App\Models\Execution;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EvaluationController extends Controller
{
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Only Admin can manage evaluations.',
            ], 403);
        }

        return null;
    }

    // Create evaluation
    public function store(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'execution_id' => ['required', 'exists:executions,id'],
            'result_status' => [
                'required',
                Rule::in(['passed', 'failed', 'warning']),
            ],
            'result_details' => ['nullable', 'string'],
        ]);

        $execution = Execution::findOrFail($data['execution_id']);

        if ($execution->status === 'running') {
            return response()->json([
                'message' => 'Cannot evaluate an execution that is still running.',
            ], 422);
        }

        $evaluation = Evaluation::create($data);
        app(AuditService::class)->log(
            'Evaluation Created',
            'Evaluation',
            $evaluation->id,
            'Created evaluation for execution ID '.$evaluation->execution_id,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Evaluation created successfully.',
            'evaluation' => $evaluation,
        ], 201);
    }

    // View all evaluations
    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $query = Evaluation::with('execution.scheduledTask')
            ->latest('created_at');

        if ($request->filled('execution_id')) {
            $query->where('execution_id', $request->execution_id);
        }

        return response()->json($query->get());
    }

    // View single evaluation
    public function show(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $evaluation = Evaluation::with(
            'execution.scheduledTask'
        )->findOrFail($id);

        return response()->json($evaluation);
    }

    // Update evaluation
    public function update(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $evaluation = Evaluation::findOrFail($id);

        $data = $request->validate([
            'result_status' => [
                'sometimes',
                Rule::in(['passed', 'failed', 'warning']),
            ],
            'result_details' => ['sometimes', 'nullable', 'string'],
        ]);

        $evaluation->update($data);
        app(AuditService::class)->log(
            'Evaluation Updated',
            'Evaluation',
            $evaluation->id,
            'Updated evaluation. Current status: '.$evaluation->result_status,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Evaluation updated successfully.',
            'evaluation' => $evaluation,
        ]);
    }
}
