<?php

namespace App\Services;

use App\Models\VirtualClock;
use Carbon\Carbon;

class ClockService
{
    public const TIMEZONE = 'Asia/Kolkata';

    public const CUTOFF_TIME = '19:30:00';

    public const DEFAULTER_TIME = '22:00:00';

    public function current(): Carbon
    {
        $clock = VirtualClock::query()->find(1);

        if ($clock && $clock->is_enabled) {
            return Carbon::parse(
                $clock->virtual_date->toDateString().' '.$clock->virtual_time,
                self::TIMEZONE
            );
        }

        return Carbon::now(self::TIMEZONE);
    }

    public function set(
        string $time,
        ?string $date = null,
        ?int $userId = null
    ): VirtualClock {
        $existingClock = VirtualClock::query()->find(1);

        if ($date === null) {
            $date = $existingClock && $existingClock->is_enabled
                ? $existingClock->virtual_date->toDateString()
                : Carbon::now(self::TIMEZONE)->toDateString();
        }

        return VirtualClock::query()->updateOrCreate(
            ['id' => 1],
            [
                'virtual_date' => $date,
                'virtual_time' => $time,
                'is_enabled' => true,
                'updated_by' => $userId,
            ]
        );
    }

    public function disable(): void
    {
        $clock = VirtualClock::query()->find(1);

        if ($clock) {
            $clock->update([
                'is_enabled' => false,
            ]);
        }
    }

    public function isPastCutoff(): bool
    {
        return $this->current()->format('H:i:s') >= self::CUTOFF_TIME;
    }

    public function isPastDefaulterTime(): bool
    {
        return $this->current()->format('H:i:s') >= self::DEFAULTER_TIME;
    }

    public function isWithinGraceWindow(): bool
    {
        $time = $this->current()->format('H:i:s');

        return $time >= self::CUTOFF_TIME
            && $time <= self::DEFAULTER_TIME;
    }

    /**
     * Classify a punch timestamp (HH:MM:SS) into attendance status and defaulter flag.
     *
     * @return array{status: string, is_defaulter: bool}
     */
    public static function classifyPunchTime(string $time): array
    {
        $normalized = substr(trim($time), 0, 8);

        if ($normalized > self::DEFAULTER_TIME) {
            return [
                'status' => 'absent',
                'is_defaulter' => true,
            ];
        }

        if ($normalized >= self::CUTOFF_TIME) {
            return [
                'status' => 'late',
                'is_defaulter' => false,
            ];
        }

        return [
            'status' => 'present',
            'is_defaulter' => false,
        ];
    }
}
