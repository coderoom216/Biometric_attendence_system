<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Token extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'student_id',
        'issued_by',
        'token_count',
        'reason',
        'issued_date',
        'month_start',
    ];

    protected $casts = [
        'token_count' => 'integer',
        'issued_date' => 'date',
        'month_start' => 'date',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function issuedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }
}
