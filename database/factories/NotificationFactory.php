<?php

namespace Database\Factories;

use App\Models\Alert;
use App\Models\Notification;
use Illuminate\Database\Eloquent\Factories\Factory;

class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    public function definition(): array
    {
        return [
            'alert_id' => Alert::inRandomOrder()->first()?->id ?? Alert::factory(),
            'channel' => $this->faker->randomElement(['sms', 'email', 'push', 'whatsapp']),
            'recipient' => $this->faker->safeEmail(),
            'delivery_status' => $this->faker->randomElement(['delivered', 'sent', 'failed']),
            'sent_at' => $this->faker->dateTimeBetween('-10 days', 'now'),
            'error_message' => null,
        ];
    }
}
