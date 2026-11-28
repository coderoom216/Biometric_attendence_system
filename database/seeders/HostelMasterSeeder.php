<?php

namespace Database\Seeders;

use App\Models\Device;
use App\Models\Hostel;
use App\Models\Role;
use App\Models\Room;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use MongoDB\Driver\Manager;
use MongoDB\Driver\Query;

class HostelMasterSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Ensure Roles
        $rolesData = [
            'Admin' => 'System administrator with full permissions.',
            'Director' => 'Overall institutional executive access.',
            'Chief Warden' => 'Coordinates all hostel operations.',
            'Residential Warden' => 'Hostel warden with direct residential oversight.',
            'Warden' => 'Hostel warden administrative access.',
            'Caretaker' => 'Hostel caretaker managing assigned hostel students, enrollment, attendance, and leave assignment.',
            'Caretaker Operator' => 'Biometric Device Manager with full multi-hostel biometric oversight.',
            'Student' => 'Resident student account.',
        ];

        $roles = [];
        foreach ($rolesData as $name => $desc) {
            $roles[$name] = Role::firstOrCreate(['name' => $name], ['description' => $desc]);
        }

        // 2. Ensure Hostels
        $h1 = Hostel::firstOrCreate(
            ['code' => 'BH1'],
            ['name' => 'Boys Hostel 1', 'address' => 'Campus Sector A, Ground Floor']
        );
        $h2 = Hostel::firstOrCreate(
            ['code' => 'GH'],
            ['name' => 'Girls Hostel', 'address' => 'Campus Sector B, North Wing']
        );
        $h3 = Hostel::firstOrCreate(
            ['code' => 'BH2'],
            ['name' => 'Boys Hostel 2', 'address' => 'Campus Sector C, South Wing']
        );

        // 3. Ensure Rooms
        $hostelConfigs = [
            [$h1, 60],
            [$h2, 55],
            [$h3, 60],
        ];

        $firstRoomBH1 = null;
        foreach ($hostelConfigs as [$hostel, $totalRooms]) {
            for ($r = 1; $r <= $totalRooms; $r++) {
                $floor = (int) ceil($r / 20);
                $roomOnFloor = (($r - 1) % 20) + 1;
                $roomNumber = $floor.str_pad((string) $roomOnFloor, 2, '0', STR_PAD_LEFT);

                $room = Room::firstOrCreate(
                    [
                        'hostel_id' => $hostel->id,
                        'room_number' => $roomNumber,
                    ],
                    [
                        'capacity' => 3,
                    ]
                );

                if ($hostel->id === $h1->id && $r === 1) {
                    $firstRoomBH1 = $room;
                }
            }
        }

        // 4. Ensure Biometric Devices for all 3 Hostels (BH1, GH, BH2)
        $devicesList = [
            [
                'hostel_id' => $h1->id,
                'device_serial' => 'RSS20241199684',
                'device_name' => 'Boys Hostel 1 Terminal (BH1 - S362)',
                'device_status' => 'online_synced',
            ],
            [
                'hostel_id' => $h2->id,
                'device_serial' => 'RSS20241199685',
                'device_name' => 'Girls Hostel Terminal (GH - S362)',
                'device_status' => 'standby',
            ],
            [
                'hostel_id' => $h3->id,
                'device_serial' => 'RSS20241199686',
                'device_name' => 'Boys Hostel 2 Terminal (BH2 - S362)',
                'device_status' => 'standby',
            ],
        ];

        foreach ($devicesList as $devItem) {
            Device::updateOrCreate(
                ['device_serial' => $devItem['device_serial']],
                [
                    'hostel_id' => $devItem['hostel_id'],
                    'device_name' => $devItem['device_name'],
                    'device_status' => $devItem['device_status'],
                    'last_sync' => now(),
                ]
            );
        }

        // 5. Ensure Staff Users
        $staffUsers = [
            [
                'name' => 'Dr. S.K.Pradhan',
                'email' => 'director@university.edu.in',
                'password' => 'director123',
                'role' => 'Director',
                'hostel_id' => null,
            ],
            [
                'name' => 'Prof. Sameer Varma',
                'email' => 'chiefwarden@university.edu.in',
                'password' => 'chief123',
                'role' => 'Chief Warden',
                'hostel_id' => null,
            ],
            [
                'name' => 'Mr. Sachin Sir',
                'email' => 'rw.shivalik@university.edu.in',
                'password' => 'rw123',
                'role' => 'Residential Warden',
                'hostel_id' => $h1->id,
            ],
            [
                'name' => 'Dr. Kavita Tariyal',
                'email' => 'warden.mandakini@university.edu.in',
                'password' => 'warden123',
                'role' => 'Warden',
                'hostel_id' => $h2->id,
            ],
            [
                'name' => 'Dr. Pathak Sir',
                'email' => 'rw.nilgiri@university.edu.in',
                'password' => 'pathak123',
                'role' => 'Warden',
                'hostel_id' => $h3->id,
            ],
            [
                'name' => 'Mehra Ji',
                'email' => 'mehra@university.edu.in',
                'password' => 'mehra123',
                'role' => 'Caretaker Operator',
                'hostel_id' => $h1->id,
            ],
            [
                'name' => 'Caretaker (Boys Hostel 1)',
                'email' => 'caretaker.bh1@university.edu.in',
                'password' => 'caretaker123',
                'role' => 'Caretaker',
                'hostel_id' => $h1->id,
            ],
            [
                'name' => 'Caretaker (Girls Hostel)',
                'email' => 'caretaker.gh@university.edu.in',
                'password' => 'caretaker123',
                'role' => 'Caretaker',
                'hostel_id' => $h2->id,
            ],
            [
                'name' => 'Caretaker (Boys Hostel 2)',
                'email' => 'caretaker.bh2@university.edu.in',
                'password' => 'caretaker123',
                'role' => 'Caretaker',
                'hostel_id' => $h3->id,
            ],
        ];

        foreach ($staffUsers as $u) {
            User::updateOrCreate(
                ['email' => $u['email']],
                [
                    'name' => $u['name'],
                    'password' => Hash::make($u['password']),
                    'role_id' => $roles[$u['role']]->id,
                    'hostel_id' => $u['hostel_id'],
                    'is_active' => true,
                ]
            );
        }

        // 6. Sync Real Biometric Enrolled Students from MongoDB into MySQL
        try {
            $mongoUri = env('BIOMETRIC_MONGO_URI', 'mongodb://127.0.0.1:27017');
            $manager = new Manager($mongoUri);

            // Read machine users
            $query = new Query([], ['sort' => ['user_id' => 1]]);
            $cursor = $manager->executeQuery('biometric_db.user_info_result', $query);

            $studentRole = $roles['Student'];
            $roomTarget = $firstRoomBH1 ?? Room::where('hostel_id', $h1->id)->first();

            foreach ($cursor as $doc) {
                $rawUid = trim((string) ($doc->user_id ?? ''));
                if (! $rawUid || $rawUid === '0') {
                    continue;
                }
                $cleanUid = ltrim($rawUid, '0') ?: $rawUid;

                $name = 'Resident '.$cleanUid;
                if (! empty($doc->info)) {
                    $info = is_string($doc->info) ? json_decode($doc->info) : $doc->info;
                    if (! empty($info->user_name)) {
                        $name = (string) $info->user_name;
                    }
                } elseif (! empty($doc->name)) {
                    $name = (string) $doc->name;
                }

                $enrollmentNo = 'BIO-'.str_pad($cleanUid, 4, '0', STR_PAD_LEFT);
                $email = 'resident'.$cleanUid.'@student.edu.in';

                $user = User::firstOrCreate(
                    ['email' => $email],
                    [
                        'name' => $name,
                        'password' => Hash::make('student123'),
                        'role_id' => $studentRole->id,
                        'hostel_id' => $h1->id,
                        'is_active' => true,
                    ]
                );

                Student::firstOrCreate(
                    ['biometric_id' => $rawUid],
                    [
                        'user_id' => $user->id,
                        'hostel_id' => $h1->id,
                        'room_id' => $roomTarget->id,
                        'enrollment_no' => $enrollmentNo,
                        'course' => 'B.Tech CSE',
                        'bed_number' => 'A',
                        'verification_status' => 'verified',
                    ]
                );
            }
        } catch (\Throwable $e) {
            echo 'Notice: MongoDB sync skipped during seeder: '.$e->getMessage().PHP_EOL;
        }
    }
}
