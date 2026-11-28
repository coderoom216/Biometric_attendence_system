<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\VirtualClock;
use Illuminate\Database\Eloquent\Factories\Factory;

class VirtualClockFactory extends Factory
{
    protected $model = VirtualClock::class;

    public function definition(): array
    {
        return [
            'virtual_date' => $this->faker->date(),
            'virtual_time' => $this->faker->time('H:i:s'),
            'is_enabled' => $this->faker->boolean(20),
            'updated_by' => User::inRandomOrder()->first()?->id,
        ];
    }
}
