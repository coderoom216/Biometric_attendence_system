<?php

namespace Tests\Feature;

use App\Models\AlertTier;
use App\Models\Hostel;
use App\Models\Role;
use App\Models\Room;
use App\Models\Student;
use App\Models\Token;
use App\Models\User;
use App\Services\ClockService;
use App\Services\DefaulterEvaluationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SemesterHolidayLeaveTokenTest extends TestCase
{
    use RefreshDatabase;

    public function test_chief_warden_semester_settings_and_semester_based_token_history(): void
    {
        $cwRole = Role::firstOrCreate(['name' => 'Chief Warden']);
        $rwRole = Role::firstOrCreate(['name' => 'Residential Warden']);
        $stuRole = Role::firstOrCreate(['name' => 'Student']);

        $bh1 = Hostel::create(['name' => 'Boys Hostel 1', 'code' => 'BH1', 'type' => 'boys', 'total_capacity' => 180]);
        $room = Room::create(['hostel_id' => $bh1->id, 'room_number' => '101', 'floor' => 1, 'capacity' => 3]);

        $cw = User::create([
            'name' => 'Chief Warden',
            'email' => 'cw@university.edu.in',
            'password' => Hash::make('chief123'),
            'role_id' => $cwRole->id,
            'is_active' => true,
        ]);

        $warden = User::create([
            'name' => 'Warden BH1',
            'email' => 'warden.bh1@university.edu.in',
            'password' => Hash::make('warden123'),
            'role_id' => $rwRole->id,
            'hostel_id' => $bh1->id,
            'is_active' => true,
        ]);

        $studentUser = User::create([
            'name' => 'Rahul Sharma',
            'email' => 'rahul@student.edu.in',
            'password' => Hash::make('student123'),
            'role_id' => $stuRole->id,
            'hostel_id' => $bh1->id,
            'is_active' => true,
        ]);

        $student = Student::create([
            'user_id' => $studentUser->id,
            'hostel_id' => $bh1->id,
            'room_id' => $room->id,
            'enrollment_no' => '23BH1101',
            'course' => 'B.Tech CSE',
            'biometric_id' => '00000101',
            'bed_number' => 'A',
            'verification_status' => Student::STATUS_VERIFIED,
        ]);

        // Unauthorized role cannot update semester
        $this->actingAs($warden, 'sanctum')
            ->putJson('/api/semester', [
                'startDate' => '2026-10-27',
                'endDate' => '2027-04-26',
            ])
            ->assertStatus(403);

        // Invalid date range rejected
        $this->actingAs($cw, 'sanctum')
            ->putJson('/api/semester', [
                'startDate' => '2027-04-26',
                'endDate' => '2026-10-27',
            ])
            ->assertStatus(422);

        // Chief Warden sets active semester (inclusive duration: 182 days)
        $this->actingAs($cw, 'sanctum')
            ->putJson('/api/semester', [
                'startDate' => '2026-10-27',
                'endDate' => '2027-04-26',
            ])
            ->assertStatus(200)
            ->assertJsonPath('semester.durationDays', 182)
            ->assertJsonPath('semester.startDate', '2026-10-27')
            ->assertJsonPath('semester.endDate', '2027-04-26');

        // Student can view active semester
        $this->actingAs($studentUser, 'sanctum')
            ->getJson('/api/semester')
            ->assertStatus(200)
            ->assertJsonPath('semester.durationDays', 182);

        // Create historical token (previous semester) + active semester tokens (within 2026-10-27..2027-04-26)
        Token::create([
            'student_id' => $student->id,
            'issued_by' => null,
            'token_count' => 7,
            'reason' => 'Previous semester violation',
            'issued_date' => '2026-08-15',
            'month_start' => '2026-08-01',
        ]);

        Token::create([
            'student_id' => $student->id,
            'issued_by' => null,
            'token_count' => 6,
            'reason' => 'Active semester defaulter',
            'issued_date' => '2026-11-10',
            'month_start' => '2026-11-01',
        ]);

        // Current semester = 6 (yellow_card), Lifetime = 13 (preserved historical tokens!)
        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/students/{$student->id}")
            ->assertStatus(200)
            ->assertJsonPath('disciplinary.currentSemesterTokens', 6)
            ->assertJsonPath('disciplinary.lifetimeTokens', 13)
            ->assertJsonPath('disciplinary.disciplinaryStatus', 'yellow_card')
            ->assertJsonPath('disciplinary.isBlacklisted', false);

        // Moving semester range forward excludes Nov 10 token from current semester without deleting history
        $this->actingAs($cw, 'sanctum')
            ->putJson('/api/semester', [
                'startDate' => '2026-12-01',
                'endDate' => '2027-05-31',
            ])
            ->assertStatus(200);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/students/{$student->id}")
            ->assertStatus(200)
            ->assertJsonPath('disciplinary.currentSemesterTokens', 0)
            ->assertJsonPath('disciplinary.lifetimeTokens', 13)
            ->assertJsonPath('disciplinary.disciplinaryStatus', 'none');
    }

    public function test_holidays_prevent_absent_defaulters_and_enforce_chief_warden_access(): void
    {
        $cwRole = Role::firstOrCreate(['name' => 'Chief Warden']);
        $stuRole = Role::firstOrCreate(['name' => 'Student']);
        AlertTier::firstOrCreate(['tier_name' => 'Normal Warning'], ['threshold' => 1]);

        $bh1 = Hostel::create(['name' => 'Boys Hostel 1', 'code' => 'BH1', 'type' => 'boys', 'total_capacity' => 180]);
        $room = Room::create(['hostel_id' => $bh1->id, 'room_number' => '102', 'floor' => 1, 'capacity' => 3]);

        $cw = User::create([
            'name' => 'Chief Warden',
            'email' => 'cw.hol@university.edu.in',
            'password' => Hash::make('chief123'),
            'role_id' => $cwRole->id,
            'is_active' => true,
        ]);

        $studentUser = User::create([
            'name' => 'Test Resident',
            'email' => 'res.hol@student.edu.in',
            'password' => Hash::make('student123'),
            'role_id' => $stuRole->id,
            'hostel_id' => $bh1->id,
            'is_active' => true,
        ]);

        $student = Student::create([
            'user_id' => $studentUser->id,
            'hostel_id' => $bh1->id,
            'room_id' => $room->id,
            'enrollment_no' => '23BH1102',
            'course' => 'B.Tech',
            'biometric_id' => '00000102',
            'bed_number' => 'A',
            'verification_status' => Student::STATUS_VERIFIED,
        ]);

        // Student cannot add holiday (403)
        $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/holidays', [
                'startDate' => '2026-11-28',
                'endDate' => '2026-11-29',
                'reason' => 'Unauthorized',
            ])
            ->assertStatus(403);

        // Chief Warden creates holiday
        $this->actingAs($cw, 'sanctum')
            ->postJson('/api/holidays', [
                'startDate' => '2026-11-28',
                'endDate' => '2026-11-29',
                'reason' => 'Convocation Break',
            ])
            ->assertStatus(201)
            ->assertJsonPath('holiday.durationDays', 2);

        // Overlapping duplicate rejected (422)
        $this->actingAs($cw, 'sanctum')
            ->postJson('/api/holidays', [
                'startDate' => '2026-11-29',
                'endDate' => '2026-11-30',
                'reason' => 'Duplicate overlap',
            ])
            ->assertStatus(422);

        // Defaulter evaluation at 10:30 PM on holiday must NOT mark student absent or issue token
        $holidayEvalTime = Carbon::parse('2026-11-28 22:30:00', ClockService::TIMEZONE);
        $summary = app(DefaulterEvaluationService::class)->evaluate($holidayEvalTime, true);

        $this->assertTrue((bool) ($summary['isHoliday'] ?? false));
        $this->assertSame(0, $summary['defaultersCount']);
        $this->assertSame(0, $summary['tokensIssued']);
        $this->assertDatabaseMissing('attendances', [
            'student_id' => $student->id,
            'is_defaulter' => true,
        ]);
        $this->assertSame(0, Token::where('student_id', $student->id)->count());
    }

    public function test_student_leave_application_and_hostel_scoped_warden_approval(): void
    {
        $rwRole = Role::firstOrCreate(['name' => 'Residential Warden']);
        $stuRole = Role::firstOrCreate(['name' => 'Student']);

        $bh1 = Hostel::create(['name' => 'Boys Hostel 1', 'code' => 'BH1', 'type' => 'boys', 'total_capacity' => 180]);
        $gh = Hostel::create(['name' => 'Girls Hostel', 'code' => 'GH', 'type' => 'girls', 'total_capacity' => 165]);
        $r1 = Room::create(['hostel_id' => $bh1->id, 'room_number' => '101', 'floor' => 1, 'capacity' => 3]);

        $wardenBh1 = User::create([
            'name' => 'Sachin Sati Sir',
            'email' => 'sachin@university.edu.in',
            'password' => Hash::make('warden123'),
            'role_id' => $rwRole->id,
            'hostel_id' => $bh1->id,
            'is_active' => true,
        ]);

        $wardenGh = User::create([
            'name' => 'Kavita Maam',
            'email' => 'kavita@university.edu.in',
            'password' => Hash::make('warden123'),
            'role_id' => $rwRole->id,
            'hostel_id' => $gh->id,
            'is_active' => true,
        ]);

        $studentUser = User::create([
            'name' => 'Rahul Sharma',
            'email' => 'rahul.leave@student.edu.in',
            'password' => Hash::make('student123'),
            'role_id' => $stuRole->id,
            'hostel_id' => $bh1->id,
            'is_active' => true,
        ]);

        Student::create([
            'user_id' => $studentUser->id,
            'hostel_id' => $bh1->id,
            'room_id' => $r1->id,
            'enrollment_no' => '23BH1101',
            'course' => 'B.Tech CSE',
            'biometric_id' => '00000201',
            'bed_number' => 'A',
            'verification_status' => Student::STATUS_VERIFIED,
        ]);

        $today = now(ClockService::TIMEZONE)->toDateString();
        $futureStart = now(ClockService::TIMEZONE)->addDay()->toDateString();
        $futureEnd = now(ClockService::TIMEZONE)->addDays(12)->toDateString();

        // Invalid range (end before start) rejected
        $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/leaves', [
                'startDate' => $futureEnd,
                'endDate' => $futureStart,
                'reason' => 'Invalid dates',
            ])
            ->assertStatus(422);

        // Past start date rejected
        $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/leaves', [
                'startDate' => now(ClockService::TIMEZONE)->subDays(2)->toDateString(),
                'endDate' => $today,
                'reason' => 'Backdated request',
            ])
            ->assertStatus(422);

        // Valid 12-day leave submission saved as Pending
        $createRes = $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/leaves', [
                'startDate' => $futureStart,
                'endDate' => $futureEnd,
                'reason' => 'Preparation for exams',
            ])
            ->assertStatus(201)
            ->assertJsonPath('leave.approvalStatus', 'pending')
            ->assertJsonPath('leave.status', 'Pending')
            ->assertJsonPath('leave.daysCount', 12);

        $leaveId = $createRes->json('leave.id');

        // Duplicate / overlapping submission rejected
        $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/leaves', [
                'startDate' => $futureStart,
                'endDate' => $futureEnd,
                'reason' => 'Duplicate request',
            ])
            ->assertStatus(422);

        // GH Warden cannot view or approve BH1 student's leave
        $this->actingAs($wardenGh, 'sanctum')
            ->getJson('/api/leaves')
            ->assertStatus(200)
            ->assertJsonPath('total', 0);

        $this->actingAs($wardenGh, 'sanctum')
            ->patchJson("/api/admin/leaves/{$leaveId}/status", ['approval_status' => 'approved'])
            ->assertStatus(403);

        // Student cannot approve own leave
        $this->actingAs($studentUser, 'sanctum')
            ->patchJson("/api/admin/leaves/{$leaveId}/status", ['approval_status' => 'approved'])
            ->assertStatus(403);

        // BH1 Warden approves leave
        $this->actingAs($wardenBh1, 'sanctum')
            ->patchJson("/api/admin/leaves/{$leaveId}/status", ['approval_status' => 'approved'])
            ->assertStatus(200)
            ->assertJsonPath('leave.status', 'Approved')
            ->assertJsonPath('leave.approvalStatus', 'approved');

        // Student sees Approved status in /api/leaves/my
        $this->actingAs($studentUser, 'sanctum')
            ->getJson('/api/leaves/my')
            ->assertStatus(200)
            ->assertJsonPath('leaves.0.status', 'Approved')
            ->assertJsonPath('leaves.0.daysCount', 12);

        // Dashboards & reports immediately reflect approved leave even on future dates
        $this->actingAs($wardenBh1, 'sanctum')
            ->getJson("/api/attendance/history?startDate={$futureStart}&endDate={$futureStart}")
            ->assertStatus(200)
            ->assertJsonPath('records.0.status', 'approved_leave');

        $this->actingAs($wardenBh1, 'sanctum')
            ->getJson("/api/reports/summary?date={$futureStart}")
            ->assertStatus(200)
            ->assertJsonPath('consolidated.totalLeave', 1);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/attendance/history?startDate={$futureStart}&endDate={$futureStart}")
            ->assertStatus(200)
            ->assertJsonPath('records.0.status', 'approved_leave');
    }
}
