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

        $adminRole = Role::where('name', 'Admin')->firstOrFail();

        User::firstOrCreate(
            ['email' => $email],
            [
                'name' => 'Nitin Saklani',
                'password' => Hash::make($password),
                'role_id' => $adminRole->id,
                'hostel_id' => null,
                'is_active' => true,
            ]
        );
    }
}
