
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blacklists', function (Blueprint $table) {
            $table->id();

            $table->foreignId('student_id')
                ->constrained('students');

            $table->date('month_start');
            $table->unsignedInteger('total_tokens');

            $table->string('status')->default('active');
            $table->dateTime('blacklisted_at');

            $table->timestamps();

            $table->unique(['student_id', 'month_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blacklists');
    }
};
