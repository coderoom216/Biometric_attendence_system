<?php

namespace Database\Factories;

use App\Models\AlertTier;
use Illuminate\Database\Eloquent\Factories\Factory;

class AlertTierFactory extends Factory
{
    protected $model = AlertTier::class;

    public function definition(): array
    {
        return [
            'tier_name' => $this->faker->unique()->words(2, true),
            'threshold' => $this->faker->numberBetween(1, 10),
        ];
    }
}
