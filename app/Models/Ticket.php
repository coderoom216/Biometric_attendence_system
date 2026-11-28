<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ticket extends Model
{
    use HasFactory;

    protected $fillable = [
        'violation_id',
        'warning_status',
        'issue_date',
    ];

    protected $casts = [
        'issue_date' => 'date',
    ];

    public function violation(): BelongsTo
    {
        return $this->belongsTo(Violation::class, 'violation_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(Action::class, 'ticket_id');
    }
}
