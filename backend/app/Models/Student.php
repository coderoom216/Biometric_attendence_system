<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
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

    public function tokens(): HasMany
    {
        return $this->hasMany(Token::class, 'student_id');
    }

    public function blacklists(): HasMany
    {
        return $this->hasMany(Blacklist::class, 'student_id');
    }
}
