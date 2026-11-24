<?php

namespace Database\Factories;

use App\Models\Ticket;
use App\Models\Violation;
use Illuminate\Database\Eloquent\Factories\Factory;

class TicketFactory extends Factory
{
    protected $model = Ticket::class;

    public function definition(): array
    {
        // Must associate with a violation that doesn't already have a ticket if possible
        $violation = Violation::doesntHave('ticket')->inRandomOrder()->first() 
            ?? Violation::factory()->create();

        return [
            'violation_id'   => $violation->id,
            'warning_status' => $this->faker->randomElement(['issued', 'resolved', 'escalated']),
            'issue_date'     => $this->faker->dateTimeBetween('-20 days', 'now')->format('Y-m-d'),
        ];
    }
}
