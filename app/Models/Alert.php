<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alert extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'student_id',
        'tier_id',
        'alert_type',
        'alert_status',
        'triggered_at',
    ];

    protected $casts = [
        'triggered_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function alertTier(): BelongsTo
    {
        return $this->belongsTo(AlertTier::class, 'tier_id');
    }
}
