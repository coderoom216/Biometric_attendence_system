
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alert_tiers', function (Blueprint $table) {
            $table->id();

            $table->string('tier_name')->unique();
            $table->unsignedInteger('threshold');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_tiers');
    }
};
