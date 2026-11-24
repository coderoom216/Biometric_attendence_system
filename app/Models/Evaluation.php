<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Evaluation extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'execution_id',
        'result_status',
        'result_details',
    ];

    public function execution(): BelongsTo
    {
        return $this->belongsTo(Execution::class, 'execution_id');
    }
}
