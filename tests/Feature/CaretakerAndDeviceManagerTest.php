<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Device;
use App\Models\Hostel;
use App\Models\Leave;
use App\Models\Role;
use App\Models\Room;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CaretakerAndDeviceManagerTest extends TestCase
{
    use RefreshDatabase;

    public function test_caretaker_is_hostel_scoped_and_can_assign_but_not_approve_leaves(): void
    {
        $managerRole = Role::firstOrCreate(['name' => 'Caretaker Operator'], ['description' => 'Biometric Device Manager']);
        $caretakerRole = Role::firstOrCreate(['name' => 'Caretaker'], ['description' => 'Hostel Caretaker']);
        $wardenRole = Role::firstOrCreate(['name' => 'Residential Warden'], ['description' => 'Residential Warden']);
        $studentRole = Role::firstOrCreate(['name' => 'Student'], ['description' => 'Student']);

        $bh1 = Hostel::create(['name' => 'Boys Hostel 1', 'code' => 'BH1', 'type' => 'boys', 'total_capacity' => 100]);
        $bh2 = Hostel::create(['name' => 'Boys Hostel 2', 'code' => 'BH2', 'type' => 'boys', 'total_capacity' => 100]);

        $room1 = Room::create(['hostel_id' => $bh1->id, 'room_number' => '101', 'capacity' => 3]);
        $room2 = Room::create(['hostel_id' => $bh2->id, 'room_number' => '101', 'capacity' => 3]);

        Device::create(['hostel_id' => $bh1->id, 'device_serial' => 'RSS20241199684', 'device_name' => 'BH1 Terminal', 'device_status' => 'online_synced']);
        Device::create(['hostel_id' => $bh2->id, 'device_serial' => 'RSS20241199686', 'device_name' => 'BH2 Terminal', 'device_status' => 'standby']);

        $mehra = User::create([
            'name' => 'Mehra Ji',
            'email' => 'mehra@university.edu.in',
            'password' => Hash::make('mehra123'),
            'role_id' => $managerRole->id,
            'hostel_id' => $bh1->id,
            'is_active' => true,
        ]);

        $caretakerBh1 = User::create([
            'name' => 'Caretaker BH1',
            'email' => 'caretaker.bh1@university.edu.in',
            'password' => Hash::make('caretaker123'),
            'role_id' => $caretakerRole->id,
            'hostel_id' => $bh1->id,
            'is_active' => true,
        ]);

        $wardenBh1 = User::create([
            'name' => 'Warden BH1',
            'email' => 'warden.bh1@university.edu.in',
            'password' => Hash::make('warden123'),
            'role_id' => $wardenRole->id,
            'hostel_id' => $bh1->id,
            'is_active' => true,
        ]);

        $s1User = User::create(['name' => 'BH1 Student', 'email' => 'bh1@student.edu.in', 'password' => Hash::make('student123'), 'role_id' => $studentRole->id, 'hostel_id' => $bh1->id, 'is_active' => true]);
        $s1 = Student::create(['user_id' => $s1User->id, 'hostel_id' => $bh1->id, 'room_id' => $room1->id, 'enrollment_no' => '24BH1001', 'course' => 'CSE', 'biometric_id' => '00000101', 'bed_number' => 'A', 'verification_status' => 'verified']);

        $s2User = User::create(['name' => 'BH2 Student', 'email' => 'bh2@student.edu.in', 'password' => Hash::make('student123'), 'role_id' => $studentRole->id, 'hostel_id' => $bh2->id, 'is_active' => true]);
        $s2 = Student::create(['user_id' => $s2User->id, 'hostel_id' => $bh2->id, 'room_id' => $room2->id, 'enrollment_no' => '24BH2001', 'course' => 'CSE', 'biometric_id' => '00000201', 'bed_number' => 'A', 'verification_status' => 'verified']);

        $att1 = Attendance::create(['student_id' => $s1->id, 'attendance_date' => now()->toDateString(), 'status' => 'absent', 'is_defaulter' => true]);
        $att2 = Attendance::create(['student_id' => $s2->id, 'attendance_date' => now()->toDateString(), 'status' => 'absent', 'is_defaulter' => true]);

        // Mehra Ji sees all hostels & devices
        $this->actingAs($mehra, 'sanctum')->getJson('/api/biometric/devices')->assertStatus(200)->assertJsonCount(2, 'devices');
        $this->actingAs($mehra, 'sanctum')->getJson('/api/students')->assertStatus(200)->assertJsonPath('total', 2);

        // BH1 Caretaker sees only BH1 device, BH1 hostel, BH1 student, BH1 attendance
        $this->actingAs($caretakerBh1, 'sanctum')->getJson('/api/biometric/devices')->assertStatus(200)->assertJsonCount(1, 'devices');
        $this->actingAs($caretakerBh1, 'sanctum')->getJson('/api/hostels')->assertStatus(200)->assertJsonPath('total', 1);
        $this->actingAs($caretakerBh1, 'sanctum')->getJson('/api/students')->assertStatus(200)->assertJsonPath('total', 1);

        // BH1 Caretaker can enroll & edit BH1 student and correct BH1 attendance
        $this->actingAs($caretakerBh1, 'sanctum')->postJson('/api/students/device-registration', [
            'enrollmentNo' => '24BH1002',
            'name' => 'New BH1 Resident',
            'hostelId' => $bh1->id,
            'roomNumber' => '101',
            'biometricId' => '00000102',
            'deviceSerial' => 'RSS20241199684',
            'studentEmail' => 'new.bh1@student.edu.in',
        ])->assertStatus(201);

        $this->actingAs($caretakerBh1, 'sanctum')->putJson("/api/students/{$s1->id}", ['name' => 'BH1 Edited'])->assertStatus(200);
        $this->actingAs($caretakerBh1, 'sanctum')->postJson('/api/attendance/correct', [
            'recordId' => $att1->id,
            'newStatus' => 'present',
            'reason' => 'Biometric verified at gate',
        ])->assertStatus(200);

        // BH1 Caretaker is blocked (403) from BH2 student, room, attendance correction, and device sync
        $this->actingAs($caretakerBh1, 'sanctum')->getJson("/api/students/{$s2->id}")->assertStatus(403);
        $this->actingAs($caretakerBh1, 'sanctum')->putJson("/api/students/{$s2->id}", ['name' => 'Illegal'])->assertStatus(403);
        $this->actingAs($caretakerBh1, 'sanctum')->getJson("/api/hostels/{$bh2->id}/rooms")->assertStatus(403);
        $this->actingAs($caretakerBh1, 'sanctum')->postJson('/api/biometric/trigger-user-fetch', ['deviceId' => 'RSS20241199686'])->assertStatus(403);
        $this->actingAs($caretakerBh1, 'sanctum')->postJson('/api/attendance/correct', [
            'recordId' => $att2->id,
            'newStatus' => 'present',
            'reason' => 'Cross hostel attempt',
        ])->assertStatus(403);
        $this->actingAs($caretakerBh1, 'sanctum')->postJson('/api/students/device-registration', [
            'enrollmentNo' => '24BH2999',
            'name' => 'Cross Hostel',
            'hostelId' => $bh2->id,
            'roomNumber' => '101',
            'biometricId' => '00000999',
            'deviceSerial' => 'RSS20241199686',
            'studentEmail' => 'cross@student.edu.in',
        ])->assertStatus(403);

        // Caretaker assigns leave -> saved as pending (NOT approved)
        $leaveRes = $this->actingAs($caretakerBh1, 'sanctum')->postJson('/api/leaves/enter', [
            'studentId' => $s1->id,
            'startDate' => now()->toDateString(),
            'endDate' => now()->addDay()->toDateString(),
            'reason' => 'Family function',
        ])->assertStatus(201)->assertJsonPath('leave.approvalStatus', 'pending');

        $leaveId = $leaveRes->json('leave.id');

        // Caretaker CANNOT approve leaves (403)
        $this->actingAs($caretakerBh1, 'sanctum')
            ->patchJson("/api/admin/leaves/{$leaveId}/status", ['approval_status' => 'approved'])
            ->assertStatus(403);

        // Warden CAN approve the Caretaker-assigned leave
        $this->actingAs($wardenBh1, 'sanctum')
            ->patchJson("/api/admin/leaves/{$leaveId}/status", ['approval_status' => 'approved'])
            ->assertStatus(200);

        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'approval_status' => 'approved',
        ]);
    }
}
