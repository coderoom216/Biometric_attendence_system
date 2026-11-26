<?php

namespace App\Models;

use App\Notifications\ApiResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'hostel_id',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

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
            new ApiResetPasswordNotification($token)
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

    public function roleSlug(): string
    {
        return strtolower(str_replace([' ', '-'], '_', $this->role?->name ?? ''));
    }

    public function isBiometricManager(): bool
    {
        return in_array($this->roleSlug(), ['caretaker_operator', 'biometric_device_manager'], true);
    }

    public function isCaretaker(): bool
    {
        return $this->roleSlug() === 'caretaker';
    }

    public function isHostelScoped(): bool
    {
        return in_array($this->roleSlug(), ['residential_warden', 'warden', 'caretaker'], true);
    }

    public function canManageStudents(): bool
    {
        return $this->roleSlug() === 'admin' || $this->isBiometricManager() || $this->isCaretaker();
    }
}
