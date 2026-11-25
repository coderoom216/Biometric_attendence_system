<?php

namespace Database\Factories;

use App\Models\Hostel;
use App\Models\Room;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class StudentFactory extends Factory
{
    protected $model = Student::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'hostel_id' => Hostel::inRandomOrder()->first()?->id ?? Hostel::factory(),
            'room_id' => Room::inRandomOrder()->first()?->id ?? Room::factory(),
            'enrollment_no' => $this->faker->unique()->numerify('EN######'),
            'course' => $this->faker->randomElement(['B.Tech', 'M.Tech', 'B.Sc', 'M.Sc', 'BCA', 'MCA', 'MBA']),
            'biometric_id' => $this->faker->unique()->numerify('BIO######'),
            'bed_number' => $this->faker->randomElement(['A', 'B', 'C', 'D']),
            'parent_guardian_name' => $this->faker->name(),
            'parent_email' => $this->faker->safeEmail(),
            'verification_status' => $this->faker->randomElement([
                Student::STATUS_VERIFIED,
                Student::STATUS_VERIFIED,
                Student::STATUS_VERIFIED,
                Student::STATUS_PENDING_VERIFICATION,
            ]),
        ];
    }
}
