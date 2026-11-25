<?php

namespace Database\Factories;

use App\Models\Device;
use App\Models\Punch;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

class PunchFactory extends Factory
{
    protected $model = Punch::class;

    public function definition(): array
    {
        $punchedAt = $this->faker->dateTimeBetween('-60 days', 'now');

        return [
            'student_id' => Student::inRandomOrder()->first()?->id ?? Student::factory(),
            'device_id' => Device::inRandomOrder()->first()?->id ?? Device::factory(),
            'punched_at' => $punchedAt,
            'synced_at' => $punchedAt,
        ];
    }
}
