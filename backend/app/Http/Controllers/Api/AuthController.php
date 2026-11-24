<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Validation\ValidationException;
use App\Services\AuditService;

class AuthController extends Controller
{
    // Register API
   

    // Login API
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($data)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        $user = User::where('email', $data['email'])->firstOrFail();
        if (!$user->is_active) {
    Auth::logout();

    return response()->json([
        'message' => 'Your account is inactive. Contact Admin.'
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
            'message' => 'Login successful',
            'user' => $user,
            'token' => $token,
        ]);
    }

    // Logout API
    // Logout API
public function logout(Request $request)
{
    $user = $request->user();

    $user->currentAccessToken()->delete();

    app(AuditService::class)->log(
        'Logout',
        'User',
        $user->id,
        'User logged out successfully.',
        $user->id
    );

    return response()->json([
        'message' => 'Logout successful',
    ]);
}

    // Forgot Password API
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        Password::sendResetLink($request->only('email'));

        return response()->json([
            'message' =>
                'If an account exists for this email, a reset link will be sent.',
        ]);
    }

    // Reset Password API
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PasswordReset) {
            return response()->json([
                'message' => __($status),
            ], 422);
        }

        return response()->json([
            'message' => 'Password reset successful',
        ]);
    }
}
