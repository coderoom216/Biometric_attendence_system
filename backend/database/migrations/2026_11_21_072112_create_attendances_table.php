
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();

            $table->foreignId('student_id')
                  ->constrained('students');

            $table->foreignId('marked_by')
                  ->nullable()
                  ->constrained('users');

            $table->date('attendance_date');
            $table->time('punch_time')->nullable();

            $table->string('status');
            $table->boolean('is_defaulter')->default(false);
            $table->text('remarks')->nullable();

            $table->unique(['student_id', 'attendance_date']);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
