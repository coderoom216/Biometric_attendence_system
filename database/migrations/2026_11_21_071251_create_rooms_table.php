
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {

            $table->id();

            $table->foreignId('hostel_id')
                  ->constrained('hostels')
                  ->cascadeOnDelete();

            $table->string('room_number');
            $table->unsignedInteger('capacity');
            // New columns required by factories and dashboards
            $table->unsignedInteger('floor')->default(1);
            $table->decimal('rent_fee', 10, 2)->default(0);
            $table->enum('status', ['available', 'full', 'maintenance'])->default('available');

            $table->unique(['hostel_id', 'room_number']);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
