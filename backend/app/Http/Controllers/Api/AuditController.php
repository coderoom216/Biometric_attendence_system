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
                'message' => 'Only Admin can access audit logs.'
            ], 403);
        }

        return null;
    }

    // View all audit logs
    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $query = Audit::with('user')
            ->orderByDesc('activity_at');

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('activity')) {
            $query->where('activity', $request->activity);
        }

        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->entity_type);
        }

        if ($request->filled('from')) {
            $query->whereDate('activity_at', '>=', $request->from);
        }

        if ($request->filled('to')) {
            $query->whereDate('activity_at', '<=', $request->to);
        }

        return response()->json($query->get());
    }

    // View single audit log
    public function show(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $audit = Audit::with('user')->findOrFail($id);

        return response()->json($audit);
    }
}
