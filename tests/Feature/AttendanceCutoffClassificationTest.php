<?php

namespace Tests\Feature;

use App\Models\Hostel;
use App\Models\Role;
use App\Models\Room;
use App\Models\Student;
use App\Models\User;
use App\Services\ClockService;
use App\Services\DefaulterEvaluationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AttendanceCutoffClassificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_punches_between_1930_and_2200_are_late_and_after_2200_are_defaulters(): void
    {
        $wardenRole = Role::firstOrCreate(['name' => 'Residential Warden'], ['description' => 'Warden']);
        $studentRole = Role::firstOrCreate(['name' => 'Student'], ['description' => 'Student']);

        $hostel = Hostel::create([
            'name' => 'Boys Hostel 1',
            'code' => 'BH1',
            'type' => 'boys',
            'total_capacity' => 100,
        ]);

        $room = Room::create([
            'hostel_id' => $hostel->id,
            'room_number' => '101',
            'capacity' => 4,
        ]);

        $warden = User::create([
            'name' => 'Warden BH1',
            'email' => 'warden.bh1@university.edu.in',
            'password' => Hash::make('warden123'),
            'role_id' => $wardenRole->id,
            'hostel_id' => $hostel->id,
            'is_active' => true,
        ]);

        $students = [];
        foreach (['OnTime', 'LateStart', 'LateEnd', 'DefaulterPunch'] as $index => $label) {
            $studentUser = User::create([
                'name' => "Student {$label}",
                'email' => strtolower($label).'@student.edu.in',
                'password' => Hash::make('student123'),
                'role_id' => $studentRole->id,
                'hostel_id' => $hostel->id,
                'is_active' => true,
            ]);

            $students[$label] = Student::create([
                'user_id' => $studentUser->id,
                'hostel_id' => $hostel->id,
                'room_id' => $room->id,
                'enrollment_no' => '24CS00'.($index + 1),
                'course' => 'CSE',
                'biometric_id' => '0000010'.($index + 1),
                'bed_number' => chr(65 + $index),
                'verification_status' => 'verified',
            ]);
        }

        $this->actingAs($warden, 'sanctum')->postJson('/api/attendance/record-punch', [
            'student_id' => $students['OnTime']->id,
            'punchTime' => '19:29:59',
        ])->assertStatus(201)
            ->assertJsonPath('record.status', 'present')
            ->assertJsonPath('record.isDefaulter', false);

        $this->actingAs($warden, 'sanctum')->postJson('/api/attendance/record-punch', [
            'student_id' => $students['LateStart']->id,
            'punchTime' => '19:30:00',
        ])->assertStatus(201)
            ->assertJsonPath('record.status', 'late')
            ->assertJsonPath('record.isDefaulter', false);

        $this->actingAs($warden, 'sanctum')->postJson('/api/attendance/record-punch', [
            'student_id' => $students['LateEnd']->id,
            'punchTime' => '22:00:00',
        ])->assertStatus(201)
            ->assertJsonPath('record.status', 'late')
            ->assertJsonPath('record.isDefaulter', false);

        $this->actingAs($warden, 'sanctum')->postJson('/api/attendance/record-punch', [
            'student_id' => $students['DefaulterPunch']->id,
            'punchTime' => '22:05:00',
        ])->assertStatus(201)
            ->assertJsonPath('record.status', 'absent')
            ->assertJsonPath('record.isDefaulter', true);

        $lateRes = $this->actingAs($warden, 'sanctum')->getJson('/api/attendance/late-punches');
        $lateRes->assertStatus(200)->assertJsonPath('count', 2);

        $lateIds = collect($lateRes->json('latePunches'))->pluck('studentId')->all();
        $this->assertEqualsCanonicalizing([
            (string) $students['LateStart']->id,
            (string) $students['LateEnd']->id,
        ], $lateIds);

        $defaulterRes = $this->actingAs($warden, 'sanctum')->getJson('/api/attendance/defaulters');
        $defaulterRes->assertStatus(200);
        $defaulterIds = collect($defaulterRes->json('defaulters'))->pluck('studentId')->all();
        $this->assertSame([(string) $students['DefaulterPunch']->id], $defaulterIds);

        $evalSummary = app(DefaulterEvaluationService::class)->evaluate(
            Carbon::today(ClockService::TIMEZONE)->setTime(22, 10, 0),
            true
        );

        $this->assertSame(1, $evalSummary['presentCount']);
        $this->assertSame(2, $evalSummary['lateCount']);
        $this->assertSame(1, $evalSummary['defaultersCount']);
    }

    public function test_unpunched_students_are_automatically_flagged_as_defaulters_after_10pm_and_for_yesterday(): void
    {
        $wardenRole = Role::firstOrCreate(['name' => 'Residential Warden'], ['description' => 'Warden']);
        $studentRole = Role::firstOrCreate(['name' => 'Student'], ['description' => 'Student']);

        $hostel = Hostel::create([
            'name' => 'Boys Hostel 1',
            'code' => 'BH1',
            'type' => 'boys',
            'total_capacity' => 100,
        ]);

        $room = Room::create([
            'hostel_id' => $hostel->id,
            'room_number' => '102',
            'capacity' => 3,
        ]);

        $warden = User::create([
            'name' => 'Warden BH1',
            'email' => 'warden.auto@university.edu.in',
            'password' => Hash::make('warden123'),
            'role_id' => $wardenRole->id,
            'hostel_id' => $hostel->id,
            'is_active' => true,
        ]);

        $yesterday = Carbon::yesterday(ClockService::TIMEZONE)->toDateString();
        $pastTimestamp = Carbon::yesterday(ClockService::TIMEZONE)->setTime(10, 0, 0)->utc();

        $lateStudentUser = User::create([
            'name' => 'Late Yesterday',
            'email' => 'late.yest@student.edu.in',
            'password' => Hash::make('student123'),
            'role_id' => $studentRole->id,
            'hostel_id' => $hostel->id,
            'is_active' => true,
        ]);
        $lateStudent = Student::create([
            'user_id' => $lateStudentUser->id,
            'hostel_id' => $hostel->id,
            'room_id' => $room->id,
            'enrollment_no' => '24CS101',
            'course' => 'CSE',
            'biometric_id' => '00000201',
            'bed_number' => 'A',
            'verification_status' => 'verified',
        ]);
        $lateStudent->forceFill(['created_at' => $pastTimestamp])->save();

        $noPunchUser = User::create([
            'name' => 'No Punch Yesterday',
            'email' => 'nopunch.yest@student.edu.in',
            'password' => Hash::make('student123'),
            'role_id' => $studentRole->id,
            'hostel_id' => $hostel->id,
            'is_active' => true,
        ]);
        $noPunchStudent = Student::create([
            'user_id' => $noPunchUser->id,
            'hostel_id' => $hostel->id,
            'room_id' => $room->id,
            'enrollment_no' => '24CS102',
            'course' => 'CSE',
            'biometric_id' => '00000202',
            'bed_number' => 'B',
            'verification_status' => 'verified',
        ]);
        $noPunchStudent->forceFill(['created_at' => $pastTimestamp])->save();

        // Yesterday had only 1 late punch (20:10); the second student never punched.
        $lateStudent->attendances()->create([
            'attendance_date' => $yesterday,
            'punch_time' => '20:10:00',
            'status' => 'late',
            'is_defaulter' => false,
        ]);

        $defaulterRes = $this->actingAs($warden, 'sanctum')
            ->getJson("/api/attendance/defaulters?date={$yesterday}");

        $defaulterRes->assertStatus(200)
            ->assertJsonPath('isDefaulterListVisible', true)
            ->assertJsonPath('count', 1)
            ->assertJsonPath('defaulters.0.studentId', (string) $noPunchStudent->id);

        $summaryRes = $this->actingAs($warden, 'sanctum')
            ->getJson("/api/reports/summary?date={$yesterday}");

        $summaryRes->assertStatus(200)
            ->assertJsonPath('consolidated.lateCount', 1)
            ->assertJsonPath('consolidated.defaultersCount', 1);
    }
}
