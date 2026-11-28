<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\SemesterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SemesterController extends Controller
{
    public function __construct(
        private SemesterService $semesterService,
        private AuditService $auditService
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'semester' => $this->semesterService->active(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user?->role?->name;

        if (! in_array($role, ['Chief Warden', 'Admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only the Chief Warden or Admin can update semester settings.',
            ], 403);
        }

        $data = $request->validate([
            'startDate' => ['required', 'date_format:Y-m-d'],
            'endDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:startDate'],
        ]);

        $semester = $this->semesterService->updateActive(
            $data['startDate'],
            $data['endDate'],
            $user->id
        );

        $this->auditService->log(
            'Semester Updated',
            'Semester',
            (int) ($semester['id'] ?? 0),
            'Active semester updated to '.$semester['startDate'].' through '.$semester['endDate'].' ('.$semester['durationDays'].' days).',
            $user->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Semester dates updated successfully.',
            'semester' => $semester,
        ]);
    }
}
