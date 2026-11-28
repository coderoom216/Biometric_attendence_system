<?php

namespace Database\Seeders;

use App\Models\Action;
use App\Models\Alert;
use App\Models\Attendance;
use App\Models\Audit;
use App\Models\Bed;
use App\Models\Device;
use App\Models\Hostel;
use App\Models\Leave;
use App\Models\Notification;
use App\Models\Punch;
use App\Models\Room;
use App\Models\Student;
use App\Models\Ticket;
use App\Models\Token;
use App\Models\User;
use App\Models\Violation;
use App\Models\VirtualClock;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // Hostels already seeded by HostelSeeder
        $hostels = Hostel::all();
        if ($hostels->isEmpty()) {
            $hostels = Hostel::factory()->count(3)->create();
        }

        // Rooms – 10 per hostel
        $hostels->each(function (Hostel $hostel) {
            Room::factory()->count(10)->create(['hostel_id' => $hostel->id]);
        });

        // Beds – 2‑4 per room
        Room::all()->each(function (Room $room) {
            $count = rand(2, 4);
            Bed::factory()->count($count)->create(['room_id' => $room->id]);
        });

        // Devices – 2 per hostel
        $hostels->each(fn ($h) => Device::factory()->count(2)->create(['hostel_id' => $h->id]));

        // Students – 15‑25 per hostel
        $hostels->each(function (Hostel $hostel) {
            $rooms = $hostel->rooms;
            Student::factory()->count(rand(15, 25))->create([
                'hostel_id' => $hostel->id,
                'room_id' => fn () => $rooms->random()->id,
            ]);
        });

        $devices = Device::all();
        $students = Student::all();
        $adminUser = User::whereHas('role', fn ($q) => $q->whereIn('name', ['Admin', 'Director', 'Chief Warden']))->first();

        // ── Attendance records (last 60 days, 1 per student per day) ──
        // This is the KEY table that powers all dashboard panels
        $today = Carbon::now('Asia/Kolkata');
        foreach (range(0, 59) as $daysAgo) {
            $date = $today->copy()->subDays($daysAgo)->toDateString();

            $students->each(function (Student $student) use ($date, $adminUser) {
                $status = fake()->randomElement([
                    'present', 'present', 'present', 'present',  // 4/7 chance present
                    'late',                                       // 1/7 late
                    'approved_leave',                             // 1/7 leave
                    'absent',                                     // 1/7 absent
                ]);

                $isDefaulter = $status === 'absent';
                $punchTime = match ($status) {
                    'present' => fake()->time('H:i:s', '19:29:59'),
                    'late' => fake()->time('H:i:s', '22:00:00'),
                    default => null,
                };

                Attendance::create([
                    'student_id' => $student->id,
                    'marked_by' => $adminUser?->id,
                    'attendance_date' => $date,
                    'punch_time' => $punchTime,
                    'status' => $status,
                    'is_defaulter' => $isDefaulter,
                    'remarks' => $isDefaulter ? 'No punch recorded' : null,
                ]);
            });
        }

        // ── Punches (raw biometric) – 10‑20 per student ──
        $students->each(function (Student $student) use ($devices) {
            $studentDevices = $devices->where('hostel_id', $student->hostel_id);
            $deviceId = $studentDevices->isNotEmpty()
                ? $studentDevices->random()->id
                : ($devices->isNotEmpty() ? $devices->random()->id : null);

            if ($deviceId) {
                Punch::factory()
                    ->count(rand(10, 20))
                    ->create([
                        'student_id' => $student->id,
                        'device_id' => $deviceId,
                    ]);
            }
        });

        // ── Leaves – 0‑3 per student ──
        $students->each(function (Student $student) {
            Leave::factory()
                ->count(rand(0, 3))
                ->create([
                    'student_id' => $student->id,
                ]);
        });

        // ── Violations – 0‑2 per student ──
        $students->each(function (Student $student) {
            Violation::factory()
                ->count(rand(0, 2))
                ->create([
                    'student_id' => $student->id,
                ]);
        });

        // ── Tickets for all violations ──
        Violation::doesntHave('ticket')->get()->each(function ($violation) {
            Ticket::factory()->create(['violation_id' => $violation->id]);
        });

        // ── Alerts – 25 random ──
        Alert::factory()->count(25)->create();

        // ── Notifications – 40 random ──
        Notification::factory()->count(40)->create();

        // ── Actions – 30 audit actions ──
        Action::factory()->count(30)->create();

        // ── Tokens (warning tokens) – 2‑5 per hostel's students ──
        $students->random(min(30, $students->count()))->each(function (Student $student) use ($adminUser) {
            Token::factory()->count(rand(1, 3))->create([
                'student_id' => $student->id,
                'issued_by' => $adminUser?->id,
            ]);
        });

        // ── Audit logs – 80 entries ──
        Audit::factory()->count(80)->create();

        // ── Virtual Clocks – 1 disabled entry (so ClockService uses real time) ──
        VirtualClock::create([
            'virtual_date' => $today->toDateString(),
            'virtual_time' => $today->toTimeString(),
            'is_enabled' => false,
            'updated_by' => $adminUser?->id,
        ]);
    }
}
