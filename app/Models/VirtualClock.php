<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VirtualClock extends Model
{
    use HasFactory;

    protected $fillable = [
        'virtual_date',
        'virtual_time',
        'is_enabled',
        'updated_by',
    ];

    protected $casts = [
        'virtual_date' => 'date',
        'is_enabled' => 'boolean',
    ];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
