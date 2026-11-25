
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();

            $table->foreignId('student_id')
                ->constrained('students');

            $table->foreignId('tier_id')
                ->constrained('alert_tiers');

            $table->string('alert_type');
            $table->string('alert_status')->default('active');

            $table->dateTime('triggered_at');

            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
