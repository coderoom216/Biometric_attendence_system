<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\AlertTier;
use App\Models\Attendance;
use App\Models\Device;
use App\Models\Hostel;
use App\Models\Notification;
use App\Models\Role;
use App\Models\Room;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FullSystemHealthCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_primary_dashboard_and_feature_endpoints_work_across_every_role(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin'], ['description' => 'Admin']);
        $directorRole = Role::firstOrCreate(['name' => 'Director'], ['description' => 'Director']);
        $chiefRole = Role::firstOrCreate(['name' => 'Chief Warden'], ['description' => 'Chief Warden']);
        $wardenRole = Role::firstOrCreate(['name' => 'Residential Warden'], ['description' => 'Residential Warden']);
        $operatorRole = Role::firstOrCreate(['name' => 'Caretaker Operator'], ['description' => 'Biometric Device Manager']);
        $caretakerRole = Role::firstOrCreate(['name' => 'Caretaker'], ['description' => 'Hostel Caretaker']);
        $studentRole = Role::firstOrCreate(['name' => 'Student'], ['description' => 'Student']);

        $bh1 = Hostel::create(['name' => 'Boys Hostel 1', 'code' => 'BH1', 'type' => 'boys', 'total_capacity' => 180]);
        $gh = Hostel::create(['name' => 'Girls Hostel', 'code' => 'GH', 'type' => 'girls', 'total_capacity' => 165]);
        $room1 = Room::create(['hostel_id' => $bh1->id, 'room_number' => '101', 'capacity' => 3]);

        Device::create(['hostel_id' => $bh1->id, 'device_serial' => 'RSS20241199684', 'device_name' => 'BH1 Terminal', 'device_status' => 'online_synced']);
        Device::create(['hostel_id' => $gh->id, 'device_serial' => 'RSS20241199685', 'device_name' => 'GH Terminal', 'device_status' => 'standby']);

        $admin = User::create(['name' => 'Admin', 'email' => 'admin@university.edu.in', 'password' => Hash::make('admin123'), 'role_id' => $adminRole->id, 'is_active' => true]);
        $director = User::create(['name' => 'Director', 'email' => 'director@university.edu.in', 'password' => Hash::make('director123'), 'role_id' => $directorRole->id, 'is_active' => true]);
        $chief = User::create(['name' => 'Chief', 'email' => 'chiefwarden@university.edu.in', 'password' => Hash::make('chief123'), 'role_id' => $chiefRole->id, 'is_active' => true]);
        $warden = User::create(['name' => 'Warden BH1', 'email' => 'warden.bh1@university.edu.in', 'password' => Hash::make('warden123'), 'role_id' => $wardenRole->id, 'hostel_id' => $bh1->id, 'is_active' => true]);
        $mehra = User::create(['name' => 'Mehra Ji', 'email' => 'mehra@university.edu.in', 'password' => Hash::make('mehra123'), 'role_id' => $operatorRole->id, 'hostel_id' => $bh1->id, 'is_active' => true]);
        $caretaker = User::create(['name' => 'Caretaker BH1', 'email' => 'caretaker.bh1@university.edu.in', 'password' => Hash::make('caretaker123'), 'role_id' => $caretakerRole->id, 'hostel_id' => $bh1->id, 'is_active' => true]);

        $studentUser = User::create(['name' => 'Rahul Sharma', 'email' => 'rahul.sharma@student.edu.in', 'password' => Hash::make('student123'), 'role_id' => $studentRole->id, 'hostel_id' => $bh1->id, 'is_active' => true]);
        $student = Student::create([
            'user_id' => $studentUser->id,
            'hostel_id' => $bh1->id,
            'room_id' => $room1->id,
            'enrollment_no' => '2024CS001',
            'course' => 'CSE',
            'biometric_id' => '00001001',
            'bed_number' => 'A',
            'verification_status' => 'verified',
        ]);

        Attendance::create([
            'student_id' => $student->id,
            'attendance_date' => now()->toDateString(),
            'punch_time' => '20:15:00',
            'status' => 'late',
            'is_defaulter' => false,
        ]);

        $tier = AlertTier::create(['tier_name' => 'residential_warden', 'threshold' => 1]);
        $alert = Alert::create(['student_id' => $student->id, 'tier_id' => $tier->id, 'alert_type' => 'Absence Alert', 'alert_status' => 'active', 'triggered_at' => now()]);
        Notification::create(['alert_id' => $alert->id, 'channel' => 'Email', 'recipient' => 'warden.bh1@university.edu.in', 'delivery_status' => 'sent', 'sent_at' => now()]);

        // Auth login check
        $this->postJson('/api/auth/login', ['email' => 'mehra@university.edu.in', 'password' => 'mehra123'])
            ->assertStatus(200)
            ->assertJsonPath('user.role', 'caretaker_operator');

        // Biometric Device Manager (Mehra Ji)
        foreach ([
            '/api/auth/me',
            '/api/hostels',
            "/api/hostels/{$bh1->id}/rooms",
            '/api/biometric/devices',
            '/api/biometric/enrolled-users',
            '/api/biometric/health',
            '/api/students',
            '/api/notifications/logs',
            '/api/system/overview',
            '/api/system/audit-logs',
            '/api/security-test/run',
            '/api/students/warning-tickets',
        ] as $endpoint) {
            $res = $this->actingAs($mehra, 'sanctum')->getJson($endpoint);
            $this->assertSame(200, $res->status(), "Failed on GET {$endpoint}: {$res->getContent()}");
        }

        // Notification structure contract check for SixTierAbsenceAlerts / DefaultersPage
        $this->actingAs($mehra, 'sanctum')
            ->getJson('/api/notifications/logs')
            ->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'stats' => ['total', 'delivered', 'queued', 'failed'],
                'hierarchy',
                'logs' => [['id', 'studentId', 'studentName', 'hostelId', 'tier', 'status']],
            ]);

        // Caretaker BH1
        foreach ([
            '/api/hostels',
            "/api/hostels/{$bh1->id}/rooms",
            '/api/biometric/devices',
            '/api/biometric/enrolled-users',
            '/api/students',
            '/api/attendance/today',
            '/api/attendance/history',
            '/api/attendance/late-punches',
            '/api/attendance/defaulters',
            '/api/leaves',
            '/api/notifications/logs',
            '/api/reports/summary',
            '/api/scheduler/status',
        ] as $endpoint) {
            $this->actingAs($caretaker, 'sanctum')->getJson($endpoint)->assertStatus(200);
        }

        // Residential Warden BH1
        foreach ([
            '/api/students',
            '/api/attendance/today',
            '/api/attendance/late-punches',
            '/api/attendance/defaulters',
            '/api/leaves',
            '/api/notifications/logs',
            '/api/reports/summary',
            '/api/students/warning-tickets',
        ] as $endpoint) {
            $this->actingAs($warden, 'sanctum')->getJson($endpoint)->assertStatus(200);
        }

        // Executive roles (Director, Chief Warden, Admin)
        foreach ([$director, $chief, $admin] as $exec) {
            foreach ([
                '/api/system/overview',
                '/api/system/audit-logs',
                '/api/reports/summary',
                '/api/reports/trends',
                '/api/scheduler/status',
                '/api/security-test/run',
                '/api/attendance/today',
                '/api/attendance/late-punches',
                '/api/attendance/defaulters',
                '/api/notifications/logs',
            ] as $endpoint) {
                $this->actingAs($exec, 'sanctum')->getJson($endpoint)->assertStatus(200);
            }
        }

        // Student role & security isolation
        foreach ([
            '/api/auth/me',
            '/api/attendance/history',
            '/api/leaves/my',
            '/api/tokens/my',
            '/api/alerts/my',
            '/api/scheduler/status',
        ] as $endpoint) {
            $this->actingAs($studentUser, 'sanctum')->getJson($endpoint)->assertStatus(200);
        }

        foreach ([
            '/api/notifications/logs',
            '/api/attendance/defaulters',
            '/api/system/audit-logs',
            '/api/biometric/devices',
        ] as $restricted) {
            $this->actingAs($studentUser, 'sanctum')->getJson($restricted)->assertStatus(403);
        }
    }

    public function test_mehra_system_health_and_missing_parent_email_retry_work_correctly(): void
    {
        $operatorRole = Role::firstOrCreate(['name' => 'Caretaker Operator'], ['description' => 'Biometric Device Manager']);
        $studentRole = Role::firstOrCreate(['name' => 'Student'], ['description' => 'Student']);

        $bh1 = Hostel::create(['name' => 'Boys Hostel 1', 'code' => 'BH1', 'type' => 'boys', 'total_capacity' => 180]);
        $room1 = Room::create(['hostel_id' => $bh1->id, 'room_number' => '101', 'capacity' => 3]);
        Device::create(['hostel_id' => $bh1->id, 'device_serial' => 'RSS20241199684', 'device_name' => 'BH1 Terminal', 'device_status' => 'standby']);

        $mehra = User::create(['name' => 'Mehra Ji', 'email' => 'mehra@university.edu.in', 'password' => Hash::make('mehra123'), 'role_id' => $operatorRole->id, 'is_active' => true]);
        $studentUser = User::create(['name' => 'Priya', 'email' => 'priya@student.edu.in', 'password' => Hash::make('student123'), 'role_id' => $studentRole->id, 'hostel_id' => $bh1->id, 'is_active' => true]);
        $student = Student::create([
            'user_id' => $studentUser->id,
            'hostel_id' => $bh1->id,
            'room_id' => $room1->id,
            'enrollment_no' => '2024CS099',
            'course' => 'CSE',
            'biometric_id' => '00001099',
            'bed_number' => 'A',
            'verification_status' => 'verified',
        ]);

        $tier = AlertTier::create(['tier_name' => 'parent_guardian', 'threshold' => 5]);
        $alert = Alert::create(['student_id' => $student->id, 'tier_id' => $tier->id, 'alert_type' => 'Absence Alert', 'alert_status' => 'active', 'triggered_at' => now()]);
        Notification::create([
            'alert_id' => $alert->id,
            'channel' => 'Email',
            'recipient' => '',
            'delivery_status' => 'failed',
            'error_message' => 'Missing parent email',
        ]);

        $this->actingAs($mehra, 'sanctum')
            ->getJson('/api/biometric/health')
            ->assertStatus(200)
            ->assertJsonPath('staleDevices.0.name', 'BH1 Terminal')
            ->assertJsonPath('staleDevices.0.lastSync', 'Never synced')
            ->assertJsonPath('missingParentEmails.0.id', (string) $student->id)
            ->assertJsonPath('notificationFailures.0.studentId', (string) $student->id)
            ->assertJsonPath('notificationFailures.0.studentName', 'Priya')
            ->assertJsonPath('notificationFailures.0.tier', $tier->id);

        $this->actingAs($mehra, 'sanctum')
            ->postJson('/api/notifications/retry', [
                'studentId' => $student->id,
                'overrideEmail' => 'parent.priya@example.com',
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('students', [
            'id' => $student->id,
            'parent_email' => 'parent.priya@example.com',
        ]);

        $this->assertDatabaseHas('notifications', [
            'alert_id' => $alert->id,
            'delivery_status' => 'delivered',
            'recipient' => 'parent.priya@example.com',
        ]);
    }
}
