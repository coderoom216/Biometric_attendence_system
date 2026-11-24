<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            HostelSeeder::class,
            RolesAndAdminSeeder::class,
            AlertTierSeeder::class,
            DemoDataSeeder::class,
        ]);
    }
}
