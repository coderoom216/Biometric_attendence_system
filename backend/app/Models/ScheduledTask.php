<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScheduledTask extends Model
{
    protected $fillable = [
        'name',
        'schedule',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function executions(): HasMany
    {
        return $this->hasMany(Execution::class, 'job_id');
    }
}
