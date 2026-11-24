
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {

            $table->id();

            $table->foreignId('hostel_id')
                  ->constrained('hostels')
                  ->cascadeOnDelete();

            $table->string('device_name');
            $table->string('device_serial')->unique();
            $table->string('device_status')->default('active');

            $table->dateTime('last_sync')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
