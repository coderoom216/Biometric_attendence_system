<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Blacklist extends Model
{
    protected $fillable = [
        'student_id',
        'month_start',
        'total_tokens',
        'status',
        'blacklisted_at',
    ];

    protected $casts = [
        'month_start' => 'date',
        'total_tokens' => 'integer',
        'blacklisted_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }
}
