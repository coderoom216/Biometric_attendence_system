<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private function formatUser(User $user): array
    {
        $user->load(['role', 'hostel', 'student']);

        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => strtolower(str_replace(
                [' ', '-'],
                '_',
                $user->role?->name ?? ''
            )),
            'phone' => null,
            'hostelId' => $user->hostel_id
                ? (string) $user->hostel_id
                : null,
            'blockId' => null,
            'studentId' => $user->student?->id
                ? (string) $user->student->id
                : null,
        ];
    }

    // Mobile API login using Sanctum token
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        if (! $user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Your account is inactive. Contact Admin.',
            ], 403);
        }

        $token = $user->createToken('mobile-app')->plainTextToken;

        app(AuditService::class)->log(
            'Login',
            'User',
            $user->id,
            'User logged in successfully.',
            $user->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'user' => $this->formatUser($user),
            'token' => $token,
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'success' => true,
            'user' => $this->formatUser($request->user()),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        $user->currentAccessToken()?->delete();

        app(AuditService::class)->log(
            'Logout',
            'User',
            $user->id,
            'User logged out successfully.',
            $user->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Logout successful',
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        Password::sendResetLink($request->only('email'));

        return response()->json([
            'success' => true,
            'message' => 'If an account exists for this email, a reset link will be sent.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Revoke all existing API tokens after password reset.
                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PasswordReset) {
            return response()->json([
                'success' => false,
                'message' => __($status),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Password reset successful',
        ]);
    }
}
