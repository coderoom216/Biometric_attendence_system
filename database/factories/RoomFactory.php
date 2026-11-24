<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\Hostel;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoomFactory extends Factory
{
    protected $model = Room::class;

    public function definition()
    {
        // Ensure a hostel exists – pick a random one
        $hostel = Hostel::inRandomOrder()->first();
        return [
            'hostel_id'    => $hostel->id,
            'room_number' => $this->faker->unique()->numberBetween(101, 999),
            'floor'       => $this->faker->numberBetween(1, 5),
            'capacity'    => $this->faker->numberBetween(2, 4),
            'rent_fee'    => $this->faker->randomFloat(2, 50, 300),
            'status'      => $this->faker->randomElement(['available', 'full', 'maintenance']),
        ];
    }
}
