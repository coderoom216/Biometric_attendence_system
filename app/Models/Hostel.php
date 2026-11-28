<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Hostel extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'address',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'hostel_id');
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class, 'hostel_id');
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class, 'hostel_id');
    }

    public function device(): HasOne
    {
        return $this->hasOne(Device::class, 'hostel_id');
    }
}
