<?php

namespace Database\Factories;

use App\Models\Audit;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AuditFactory extends Factory
{
    protected $model = Audit::class;

    public function definition(): array
    {
        return [
            'user_id' => User::inRandomOrder()->first()?->id,
            'activity' => $this->faker->randomElement([
                'login', 'logout', 'student.create', 'student.update',
                'leave.approve', 'leave.reject', 'attendance.correct',
                'violation.create', 'ticket.issue', 'alert.trigger',
                'device.sync', 'clock.set', 'report.export',
            ]),
            'entity_type' => $this->faker->randomElement([
                'Student', 'Leave', 'Attendance', 'Violation', 'Ticket',
                'Alert', 'Device', 'VirtualClock', 'User',
            ]),
            'entity_id' => $this->faker->numberBetween(1, 50),
            'details' => $this->faker->sentence(),
            'activity_at' => $this->faker->dateTimeBetween('-60 days', 'now'),
        ];
    }
}
