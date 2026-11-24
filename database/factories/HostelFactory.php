<?php

namespace Database\Factories;

use App\Models\Hostel;
use Illuminate\Database\Eloquent\Factories\Factory;

class HostelFactory extends Factory
{
    protected $model = Hostel::class;

    public function definition()
    {
        return [
            'name'    => $this->faker->unique()->company . ' Hostel',
            'code'    => $this->faker->unique()->slug,
            'address' => $this->faker->address,
        ];
    }
}
