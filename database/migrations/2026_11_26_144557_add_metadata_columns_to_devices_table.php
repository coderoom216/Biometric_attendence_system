<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->string('model_no')->nullable()->after('device_serial');
            $table->string('ip_address', 45)->nullable()->after('model_no');
            $table->string('firmware_version')->nullable()->after('ip_address');
            $table->string('location')->nullable()->after('firmware_version');
        });
    }

    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->dropColumn([
                'model_no',
                'ip_address',
                'firmware_version',
                'location',
            ]);
        });
    }
};
