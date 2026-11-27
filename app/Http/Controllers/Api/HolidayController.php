<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Holiday;
use App\Services\AuditService;
use App\Services\ClockService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    public function __construct(
        private ClockService $clockService,
        private AuditService $auditService
    ) {}

    /**
     * Format a Holiday model for API consumers.
     *
     * @return array<string, mixed>
     */
    private function formatHoliday(Holiday $holiday): array
    {
        $startStr = $holiday->start_date->toDateString();
        $endStr = $holiday->end_date->toDateString();
        $start = Carbon::createFromFormat('Y-m-d', $startStr, ClockService::TIMEZONE)->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $endStr, ClockService::TIMEZONE)->startOfDay();
        $today = $this->clockService->current()->toDateString();

        return [
            'id' => (string) $holiday->id,
            'startDate' => $startStr,
            'endDate' => $endStr,
            'durationDays' => (int) $start->diffInDays($end) + 1,
            'reason' => $holiday->reason,
            'isPast' => $endStr < $today,
            'isCurrentOrUpcoming' => $endStr >= $today,
            'createdBy' => $holiday->createdBy?->name ?? 'Chief Warden',
        ];
    }

    public function index(): JsonResponse
    {
        $today = $this->clockService->current()->toDateString();
        $holidays = Holiday::with('createdBy:id,name')
            ->orderBy('start_date')
            ->orderBy('id')
            ->get()
            ->map(fn (Holiday $h) => $this->formatHoliday($h))
            ->values();

        return response()->json([
            'success' => true,
            'today' => $today,
            'holidays' => $holidays,
            'upcomingHolidays' => $holidays->filter(fn (array $h) => $h['endDate'] >= $today)->values(),
            'pastHolidays' => $holidays->filter(fn (array $h) => $h['endDate'] < $today)->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user?->role?->name;

        if (! in_array($role, ['Chief Warden', 'Admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only the Chief Warden or Admin can declare institutional holidays.',
            ], 403);
        }

        if (! $request->filled('endDate') && $request->filled('startDate')) {
            $request->merge(['endDate' => $request->input('startDate')]);
        }

        $data = $request->validate([
            'startDate' => ['required', 'date_format:Y-m-d'],
            'endDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'reason' => ['required', 'string', 'min:2', 'max:500'],
        ]);

        $overlapping = Holiday::query()
            ->whereDate('start_date', '<=', $data['endDate'])
            ->whereDate('end_date', '>=', $data['startDate'])
            ->exists();

        if ($overlapping) {
            return response()->json([
                'success' => false,
                'message' => 'An official holiday is already scheduled within the selected dates.',
            ], 422);
        }

        $holiday = Holiday::query()->create([
            'start_date' => $data['startDate'],
            'end_date' => $data['endDate'],
            'reason' => trim($data['reason']),
            'created_by' => $user->id,
        ]);

        $this->auditService->log(
            'Holiday Declared',
            'Holiday',
            $holiday->id,
            'Official holiday declared: '.$data['startDate'].' to '.$data['endDate'].' — '.$holiday->reason,
            $user->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Institutional holiday added successfully.',
            'holiday' => $this->formatHoliday($holiday->fresh()->load('createdBy:id,name')),
        ], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $role = $user?->role?->name;

        if (! in_array($role, ['Chief Warden', 'Admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only the Chief Warden or Admin can remove holidays.',
            ], 403);
        }

        $holiday = Holiday::findOrFail($id);
        $label = $holiday->start_date->toDateString().' to '.$holiday->end_date->toDateString().' ('.$holiday->reason.')';
        $holiday->delete();

        $this->auditService->log(
            'Holiday Removed',
            'Holiday',
            $id,
            'Removed institutional holiday: '.$label,
            $user->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Institutional holiday removed.',
        ]);
    }
}
