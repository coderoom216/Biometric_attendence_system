
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('actions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('ticket_id')
                  ->constrained('tickets');

            $table->foreignId('user_id')
                  ->constrained('users');

            $table->text('action_taken');
            $table->dateTime('action_date');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('actions');
    }
};
