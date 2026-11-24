
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {

            $table->id();

            // User relationship (One-to-One)
            $table->foreignId('user_id')
                  ->unique()
                  ->constrained('users');

            // Hostel and Room relationships
            $table->foreignId('hostel_id')
                  ->constrained('hostels');

            $table->foreignId('room_id')
                  ->constrained('rooms');

            // Student information
            $table->string('enrollment_no')->unique();
            $table->string('course');

            // Biometric information
            $table->string('biometric_id')->unique();

            // Room allocation information
            $table->string('bed_number');

            // Parent / Guardian information
            $table->string('parent_guardian_name')->nullable();
            $table->string('parent_email')->nullable();

            // Verification status
            $table->string('verification_status')->default('pending_verification');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
