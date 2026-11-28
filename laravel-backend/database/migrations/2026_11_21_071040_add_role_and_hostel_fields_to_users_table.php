
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {

            $table->foreignId('role_id')
                ->nullable()
                ->constrained('roles');

            $table->foreignId('hostel_id')
                ->nullable()
                ->constrained('hostels');

            $table->boolean('is_active')->default(true);

        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {

            $table->dropForeign(['role_id']);
            $table->dropForeign(['hostel_id']);

            $table->dropColumn([
                'role_id',
                'hostel_id',
                'is_active',
            ]);

        });
    }
};
