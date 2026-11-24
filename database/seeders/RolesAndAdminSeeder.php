<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class RolesAndAdminSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            'Admin' => 'System administrator with full access.',
            'Residential Warden' => 'Manages the assigned hostel.',
            'Chief Warden' => 'Supervises hostel operations.',
            'Director' => 'Institution-level management access.',
            'Caretaker Operator' => 'Manages student-related operations.',
            'Student' => 'Student account access.',
        ];

        foreach ($roles as $name => $description) {
            Role::firstOrCreate(
                ['name' => $name],
                ['description' => $description]
            );
        }

        $email = env('INITIAL_ADMIN_EMAIL');
        $password = env('INITIAL_ADMIN_PASSWORD');

        if (empty($email) || empty($password)) {
            throw new RuntimeException(
                'Initial Admin credentials are missing from .env.'
            );
        }

        // Demo users for each role
        $demoUsers = [
            [
                'email' => 'director@university.edu.in',
                'password' => 'director123',
                'role' => 'Director',
                'name' => 'Demo Director',
            ],
            [
                'email' => 'chiefwarden@university.edu.in',
                'password' => 'chief123',
                'role' => 'Chief Warden',
                'name' => 'Demo Chief Warden',
            ],
            [
                'email' => 'rw.shivalik@university.edu.in',
                'password' => 'rw123',
                'role' => 'Residential Warden',
                'name' => 'Demo Residential Warden',
                'hostel_id' => 1, // assuming hostel id 1 exists
            ],
            [
                'email' => 'warden.mandakini@university.edu.in',
                'password' => 'warden123',
                'role' => 'Residential Warden',
                'name' => 'Demo Warden Mandakini',
                'hostel_id' => 2,
            ],
            [
                'email' => 'rw.nilgiri@university.edu.in',
                'password' => 'pathak123',
                'role' => 'Residential Warden',
                'name' => 'Demo Warden Nilgiri',
                'hostel_id' => 3,
            ],
            [
                'email' => 'vmehra@university.edu.in',
                'password' => 'mehra123',
                'role' => 'Caretaker Operator',
                'name' => 'Demo Caretaker',
            ],
            [
                'email' => 'rahul.sharma@student.edu.in',
                'password' => 'student123',
                'role' => 'Student',
                'name' => 'Demo Student',
            ],
        ];

        foreach ($demoUsers as $demo) {
            $role = Role::where('name', $demo['role'])->firstOrFail();
            User::updateOrCreate(
                ['email' => $demo['email']],
                [
                    'name' => $demo['name'],
                    'password' => Hash::make($demo['password']),
                    'role_id' => $role->id,
                    'hostel_id' => $demo['hostel_id'] ?? null,
                    'is_active' => true,
                ]
            );
        }
    }
}
