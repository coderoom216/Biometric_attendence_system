<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Audit extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'activity',
        'entity_type',
        'entity_id',
        'details',
        'activity_at',
    ];

    protected $casts = [
        'activity_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
