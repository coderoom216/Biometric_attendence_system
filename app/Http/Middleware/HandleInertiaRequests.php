<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),

            'auth' => [
                'user' => $user ? [
                    'id' => (string) $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => strtolower(str_replace(
                        [' ', '-'],
                        '_',
                        $user->role?->name ?? ''
                    )),
                    'hostelId' => $user->hostel_id
                        ? (string) $user->hostel_id
                        : null,
                    'studentId' => $user->student?->id
                        ? (string) $user->student->id
                        : null,
                ] : null,
            ],
        ];
    }
}
