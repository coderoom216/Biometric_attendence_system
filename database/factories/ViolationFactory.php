<?php

namespace Database\Factories;

use App\Models\Student;
use App\Models\Violation;
use Illuminate\Database\Eloquent\Factories\Factory;

class ViolationFactory extends Factory
{
    protected $model = Violation::class;

    public function definition(): array
    {
        return [
            'student_id' => Student::inRandomOrder()->first()?->id ?? Student::factory(),
            'violation_type' => $this->faker->randomElement(['Curfew Breach', 'Noise Complaint', 'Unauthorized Guest', 'Property Damage', 'Ragging']),
            'violation_date' => $this->faker->dateTimeBetween('-30 days', 'now')->format('Y-m-d'),
            'description' => $this->faker->sentence(),
        ];
    }
}
