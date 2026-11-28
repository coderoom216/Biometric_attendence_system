
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();

            $table->foreignId('alert_id')
                ->constrained('alerts');

            $table->string('channel');
            $table->string('recipient');

            $table->string('delivery_status')->default('pending');

            $table->dateTime('sent_at')->nullable();
            $table->text('error_message')->nullable();

            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
