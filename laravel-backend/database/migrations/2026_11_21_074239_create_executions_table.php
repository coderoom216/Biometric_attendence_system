
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('executions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('job_id')
                  ->constrained('scheduled_tasks');

            $table->dateTime('started_at');
            $table->dateTime('completed_at')->nullable();

            $table->string('status');
            $table->text('error_message')->nullable();

            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('executions');
    }
};
