<?php

namespace App\Services;

use App\Models\Holiday;
use App\Models\Semester;
use Carbon\Carbon;

class SemesterService
{
    public function __construct(
        private ClockService $clockService
    ) {}

    /**
     * Get the active semester range and inclusive duration in days.
     *
     * @return array{id: ?int, startDate: string, endDate: string, durationDays: int, isCustom: bool}
     */
    public function active(): array
    {
        $record = Semester::query()
            ->where('is_active', true)
            ->latest('id')
            ->first();

        if ($record) {
            $start = Carbon::createFromFormat('Y-m-d', $record->start_date->toDateString(), ClockService::TIMEZONE)->startOfDay();
            $end = Carbon::createFromFormat('Y-m-d', $record->end_date->toDateString(), ClockService::TIMEZONE)->startOfDay();

            return [
                'id' => $record->id,
                'startDate' => $start->toDateString(),
                'endDate' => $end->toDateString(),
                'durationDays' => (int) $start->diffInDays($end) + 1,
                'isCustom' => true,
            ];
        }

        $current = $this->clockService->current();
        $defaultStart = $current->copy()->subMonthsNoOverflow(1)->startOfDay();
        $defaultEnd = $defaultStart->copy()->addMonthsNoOverflow(6)->subDay()->startOfDay();

        return [
            'id' => null,
            'startDate' => $defaultStart->toDateString(),
            'endDate' => $defaultEnd->toDateString(),
            'durationDays' => (int) $defaultStart->diffInDays($defaultEnd) + 1,
            'isCustom' => false,
        ];
    }

    /**
     * Save or update the active semester range.
     *
     * @return array{id: ?int, startDate: string, endDate: string, durationDays: int, isCustom: bool}
     */
    public function updateActive(string $startDate, string $endDate, ?int $userId = null): array
    {
        Semester::query()->where('is_active', true)->update(['is_active' => false]);

        Semester::query()->create([
            'start_date' => $startDate,
            'end_date' => $endDate,
            'is_active' => true,
            'updated_by' => $userId,
        ]);

        return $this->active();
    }

    public function isWithinActiveSemester(string $date): bool
    {
        $active = $this->active();

        return $date >= $active['startDate'] && $date <= $active['endDate'];
    }

    public function holidayForDate(string $date): ?Holiday
    {
        return Holiday::query()
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->first();
    }
}
