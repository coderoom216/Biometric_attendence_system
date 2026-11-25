<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    public const ADMIN = 'Admin';

    public const RESIDENTIAL_WARDEN = 'Residential Warden';

    public const CHIEF_WARDEN = 'Chief Warden';

    public const DIRECTOR = 'Director';

    public const CARETAKER_OPERATOR = 'Caretaker Operator';

    public const STUDENT = 'Student';

    protected $fillable = [
        'name',
        'description',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id');
    }
}
