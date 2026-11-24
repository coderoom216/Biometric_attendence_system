<?php

namespace Database\Factories;

use App\Models\Attendance;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AttendanceFactory extends Factory
{
    protected $model = Attendance::class;

    public function definition(): array
    {
        $status = $this->faker->randomElement(['present', 'present', 'present', 'late', 'approved_leave', 'absent']);
        $isDefaulter = $status === 'absent';
        $punchTime = in_array($status, ['present', 'late'])
            ? ($status === 'late'
                ? $this->faker->time('H:i:s', '22:00:00')
                : $this->faker->time('H:i:s', '19:00:00'))
            : null;

        return [
            'student_id'      => Student::inRandomOrder()->first()?->id ?? Student::factory(),
            'marked_by'       => User::inRandomOrder()->first()?->id,
            'attendance_date' => $this->faker->dateTimeBetween('-30 days', 'now')->format('Y-m-d'),
            'punch_time'      => $punchTime,
            'status'          => $status,
            'is_defaulter'    => $isDefaulter,
            'remarks'         => $isDefaulter ? 'No punch recorded' : null,
        ];
    }
}
