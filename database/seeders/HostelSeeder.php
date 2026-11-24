<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Hostel;

class HostelSeeder extends Seeder
{
    /**
     * Run the database seeders.
     */
    public function run(): void
    {
        $hostels = [
            [
                // id will be auto‑generated
                'name' => 'Shivalik Hostel',
                'code' => 'shivalik',
                'address' => 'Shivalik Campus, Block A',
            ],
            [
                'name' => 'Mandakini Hostel',
                'code' => 'mandakini',
                'address' => 'Mandakini Campus, Block B',
            ],
            [
                'name' => 'Nilgiri Hostel',
                'code' => 'nilgiri',
                'address' => 'Nilgiri Campus, Block C',
            ],
        ];

        foreach ($hostels as $data) {
            // firstOrCreate on the unique "code" column
            Hostel::firstOrCreate(['code' => $data['code']], $data);
        }
    }
}
