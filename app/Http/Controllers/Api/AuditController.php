<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'success' => false,
                'message' => 'Only Admin can access audit logs.',
            ], 403);
        }

        return null;
    }

    // View audit logs with optional filters.
    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $filters = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'activity' => ['nullable', 'string', 'max:255'],
            'entity_type' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $query = Audit::with('user')
            ->orderByDesc('activity_at');

        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (!empty($filters['activity'])) {
            $query->where('activity', $filters['activity']);
        }

        if (!empty($filters['entity_type'])) {
            $query->where('entity_type', $filters['entity_type']);
        }

        if (!empty($filters['from'])) {
            $query->whereDate('activity_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('activity_at', '<=', $filters['to']);
        }

        $logs = $query->get()->map(fn ($a) => [
            'id' => (string) $a->id,
            'userId' => (string) $a->user_id,
            'userName' => $a->user?->name ?? 'System',
            'action' => $a->activity,
            'activity' => $a->activity,
            'entityType' => $a->entity_type,
            'entity_type' => $a->entity_type,
            'entityId' => (string) $a->entity_id,
            'details' => $a->details,
            'timestamp' => $a->activity_at?->toIso8601String() ?? $a->created_at?->toIso8601String(),
        ]);

        return response()->json([
            'success' => true,
            'total' => $logs->count(),
            'logs' => $logs,
        ]);
    }

    // View a single audit log.
    public function show(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $audit = Audit::with('user')->findOrFail($id);

        return response()->json($audit);
    }
}
