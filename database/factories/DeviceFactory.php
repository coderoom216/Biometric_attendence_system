<?php

namespace Database\Factories;

use App\Models\Device;
use Illuminate\Database\Eloquent\Factories\Factory;

class DeviceFactory extends Factory
{
    protected $model = Device::class;

    public function definition()
    {
        return [
            // hostel_id will be supplied by the seeder
            'device_name'   => $this->faker->unique()->company . ' Device',
            'device_serial' => $this->faker->unique()->ean13,
            'device_status' => Device::STATUS_ACTIVE,
            'last_sync'     => $this->faker->dateTimeBetween('-30 days', 'now'),
        ];
    }
}
