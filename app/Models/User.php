<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'name',
    'email',
    'password',
    'role_id',
    'hostel_id',
    'is_active',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(
            new \App\Notifications\ApiResetPasswordNotification($token)
        );
    }

    // User belongs to one Role
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    // User belongs to one Hostel
    public function hostel(): BelongsTo
    {
        return $this->belongsTo(Hostel::class, 'hostel_id');
    }
// User has one Student profile
public function student(): HasOne
{
    return $this->hasOne(Student::class, 'user_id');
}
    // User can perform multiple Actions
    public function actions(): HasMany
    {
        return $this->hasMany(Action::class, 'user_id');
    }

    // User can have multiple Audit records
    public function audits(): HasMany
    {
        return $this->hasMany(Audit::class, 'user_id');
    }
}
