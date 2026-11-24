<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Device extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'hostel_id',
        'device_name',
        'device_serial',
        'device_status',
        'last_sync',
    ];

    protected $casts = [
        'last_sync' => 'datetime',
    ];

    public function hostel(): BelongsTo
    {
        return $this->belongsTo(Hostel::class, 'hostel_id');
    }

    public function punches(): HasMany
    {
        return $this->hasMany(Punch::class, 'device_id');
    }
}
