<?php

namespace Database\Factories;

use App\Models\Action;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ActionFactory extends Factory
{
    protected $model = Action::class;

    public function definition(): array
    {
        return [
            'ticket_id' => Ticket::inRandomOrder()->first()?->id ?? Ticket::factory(),
            'user_id' => User::inRandomOrder()->first()?->id ?? User::factory(),
            'action_taken' => $this->faker->randomElement(['Parent Called', 'Fine Issued', 'Counseling Session Conducted', 'Written Warning Issued', 'Suspension Recommendation']),
            'action_date' => $this->faker->dateTimeBetween('-10 days', 'now'),
        ];
    }
}
