<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AlertTier;

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
