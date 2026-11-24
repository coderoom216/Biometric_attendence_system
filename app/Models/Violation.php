<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Violation extends Model
{
    protected $fillable = [
        'student_id',
        'violation_type',
        'violation_date',
        'description',
    ];

    protected $casts = [
        'violation_date' => 'date',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function ticket(): HasOne
    {
        return $this->hasOne(Ticket::class, 'violation_id');
    }
}
