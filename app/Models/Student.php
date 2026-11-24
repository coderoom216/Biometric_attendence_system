<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Student extends Model
{
    use HasFactory;

    public const STATUS_PENDING_VERIFICATION = 'pending_verification';
    public const STATUS_VERIFIED = 'verified';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id',
        'hostel_id',
        'room_id',
        'enrollment_no',
        'course',
        'biometric_id',
        'bed_number',
        'parent_guardian_name',
        'parent_email',
        'verification_status',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'hostel_id' => 'integer',
            'room_id' => 'integer',
        ];
    }

    public function isVerified(): bool
    {
        return $this->verification_status === self::STATUS_VERIFIED;
    }

    public function isPending(): bool
    {
        return $this->verification_status === self::STATUS_PENDING_VERIFICATION;
    }

    public function scopeVerified(Builder $query): Builder
    {
        return $query->where('verification_status', self::STATUS_VERIFIED);
    }

    public function scopeForHostel(Builder $query, int|string $hostelId): Builder
    {
        return $query->where('hostel_id', $hostelId);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function hostel(): BelongsTo
    {
        return $this->belongsTo(Hostel::class, 'hostel_id');
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'room_id');
    }

    public function punches(): HasMany
    {
        return $this->hasMany(Punch::class, 'student_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'student_id');
    }

    public function leaves(): HasMany
    {
        return $this->hasMany(Leave::class, 'student_id');
    }

    public function violations(): HasMany
    {
        return $this->hasMany(Violation::class, 'student_id');
    }

    public function tickets(): HasManyThrough
    {
        return $this->hasManyThrough(Ticket::class, Violation::class, 'student_id', 'violation_id');
    }

    public function tokens(): HasMany
    {
        return $this->hasMany(Token::class, 'student_id');
    }

    public function blacklists(): HasMany
    {
        return $this->hasMany(Blacklist::class, 'student_id');
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class, 'student_id');
    }
}
