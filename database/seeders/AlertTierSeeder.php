<?php

namespace Database\Seeders;

use App\Models\AlertTier;
use Illuminate\Database\Seeder;

class AlertTierSeeder extends Seeder
{
    public function run(): void
    {
        AlertTier::updateOrCreate(
            ['tier_name' => 'Yellow Card'],
            ['threshold' => 5]
        );

        AlertTier::updateOrCreate(
            ['tier_name' => 'Red Card'],
            ['threshold' => 8]
        );
    }
}
