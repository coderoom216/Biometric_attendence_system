<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Execution extends Model
{
    public function evaluations(): HasMany
{
    return $this->hasMany(Evaluation::class, 'execution_id');
}
    public $timestamps = false;

    protected $fillable = [
        'job_id',
        'started_at',
        'completed_at',
        'status',
        'error_message',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function scheduledTask(): BelongsTo
    {
        return $this->belongsTo(ScheduledTask::class, 'job_id');
    }
}
