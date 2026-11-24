<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AlertTier extends Model
{
    use HasFactory;

    protected $fillable = [
        'tier_name',
        'threshold',
    ];

    protected $casts = [
        'threshold' => 'integer',
    ];

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class, 'tier_id');
    }
}
