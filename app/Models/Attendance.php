<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    protected $fillable = [
        'student_id',
        'marked_by',
        'attendance_date',
        'punch_time',
        'status',
        'is_defaulter',
        'remarks',
    ];

    protected $casts = [
        'attendance_date' => 'date',
        'punch_time' => 'string',
        'is_defaulter' => 'boolean',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function markedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_by');
    }
}
