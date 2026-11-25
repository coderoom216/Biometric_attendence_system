<?php

namespace Database\Factories;

use App\Models\Leave;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeaveFactory extends Factory
{
    protected $model = Leave::class;

    public function definition(): array
    {
        $startDate = $this->faker->dateTimeBetween('-20 days', '+10 days');
        $endDate = (clone $startDate)->modify('+'.rand(1, 5).' days');
        $status = $this->faker->randomElement(['pending', 'approved', 'rejected']);

        return [
            'student_id' => Student::inRandomOrder()->first()?->id ?? Student::factory(),
            'approved_by' => $status !== 'pending' ? (User::inRandomOrder()->first()?->id ?? User::factory()) : null,
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $endDate->format('Y-m-d'),
            'reason' => $this->faker->sentence(),
            'gate_pass_no' => 'GP-'.$this->faker->unique()->numerify('#####'),
            'approval_status' => $status,
            'approved_at' => $status !== 'pending' ? $startDate : null,
        ];
    }
}
