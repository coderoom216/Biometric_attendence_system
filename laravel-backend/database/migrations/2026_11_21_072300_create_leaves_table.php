
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leaves', function (Blueprint $table) {
            $table->id();

            $table->foreignId('student_id')
                ->constrained('students');

            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users');

            $table->date('start_date');
            $table->date('end_date');

            $table->text('reason');
            $table->string('gate_pass_no')->unique();

            $table->string('approval_status')->default('pending');
            $table->dateTime('approved_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leaves');
    }
};
