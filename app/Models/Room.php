<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Room extends Model
{
    use HasFactory;

    protected $fillable = [
        'hostel_id',
        'room_number',
        'capacity',
    ];

    protected $casts = [
        'capacity' => 'integer',
    ];

    public function hostel(): BelongsTo
    {
        return $this->belongsTo(Hostel::class, 'hostel_id');
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class, 'room_id');
    }

    public function currentOccupancy(): int
    {
        return $this->students()->count();
    }

    public function isFull(): bool
    {
        return $this->currentOccupancy() >= $this->capacity;
    }
}
