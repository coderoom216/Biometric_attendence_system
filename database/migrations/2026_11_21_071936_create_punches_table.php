
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('punches', function (Blueprint $table) {

            $table->id();

            // Student relationship
            $table->foreignId('student_id')
                  ->constrained('students');

            // Biometric device relationship
            $table->foreignId('device_id')
                  ->constrained('devices');

            // Biometric punch information
            $table->dateTime('punched_at');
            $table->dateTime('synced_at');

            // Creation timestamp only
            $table->timestamp('created_at')->useCurrent();

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('punches');
    }
};
