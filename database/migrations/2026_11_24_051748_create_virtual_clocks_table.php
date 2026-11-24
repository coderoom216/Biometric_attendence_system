
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('virtual_clocks', function (Blueprint $table) {
            $table->id();

            $table->date('virtual_date');
            $table->time('virtual_time');

            $table->boolean('is_enabled')->default(false);

            $table->foreignId('updated_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('virtual_clocks');
    }
};
