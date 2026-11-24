<?php

namespace Database\Factories;

use App\Models\Token;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class TokenFactory extends Factory
{
    protected $model = Token::class;

    public function definition(): array
    {
        $issuedDate = $this->faker->dateTimeBetween('-60 days', 'now');

        return [
            'student_id'  => Student::inRandomOrder()->first()?->id ?? Student::factory(),
            'issued_by'   => User::inRandomOrder()->first()?->id,
            'token_count' => $this->faker->numberBetween(1, 3),
            'reason'      => $this->faker->randomElement([
                'Late entry after curfew',
                'Missed attendance',
                'Unauthorized absence',
                'Noise complaint',
                'Curfew breach',
            ]),
            'issued_date' => $issuedDate->format('Y-m-d'),
            'month_start' => $issuedDate->format('Y-m-01'),
        ];
    }
}
