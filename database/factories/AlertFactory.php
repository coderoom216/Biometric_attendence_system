<?php

namespace Database\Factories;

use App\Models\Alert;
use App\Models\Student;
use App\Models\AlertTier;
use Illuminate\Database\Eloquent\Factories\Factory;

class AlertFactory extends Factory
{
    protected $model = Alert::class;

    public function definition(): array
    {
        return [
            'student_id'   => Student::inRandomOrder()->first()?->id ?? Student::factory(),
            'tier_id'      => AlertTier::inRandomOrder()->first()?->id ?? 1,
            'alert_type'   => $this->faker->randomElement(['Late Entry', 'Missed Curfew', 'Unauthorized Absence', 'Consecutive Absence']),
            'alert_status' => $this->faker->randomElement(['active', 'resolved', 'escalated', 'dismissed']),
            'triggered_at' => $this->faker->dateTimeBetween('-15 days', 'now'),
        ];
    }
}
