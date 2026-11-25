<?php

namespace Database\Factories;

use App\Models\Bed;
use Illuminate\Database\Eloquent\Factories\Factory;

class BedFactory extends Factory
{
    protected $model = Bed::class;

    public function definition()
    {
        return [
            // room_id will be set in the seeder via create([...])
            'bed_identifier' => $this->faker->lexify('Bed ?'),
            'is_occupied' => $this->faker->boolean(30), // 30% occupied by default
        ];
    }
}
