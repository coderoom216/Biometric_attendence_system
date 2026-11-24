<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use App\Services\AuditService;

class AdminController extends Controller
{
    // Check whether logged-in user is Admin
    private function checkAdmin(Request $request)
    {
        if (!$request->user() ||
            $request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        return null;
    }

    // Create staff account
    public function storeUser(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'role_id' => [
                'required',
                Rule::exists('roles', 'id')->whereIn(
                    'name',
                    [
                        'Admin',
                        'Residential Warden',
                        'Chief Warden',
                        'Director'
                    ]
                ),
            ],
            'hostel_id' => 'nullable|exists:hostels,id',
        ]);

        $role = Role::findOrFail($data['role_id']);

        if (
            $role->name === 'Residential Warden' &&
            empty($data['hostel_id'])
        ) {
            return response()->json([
                'message' => 'Residential Warden must be assigned a hostel.'
            ], 422);
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role_id' => $role->id,
            'hostel_id' => $role->name === 'Residential Warden'
                ? $data['hostel_id']
                : null,
            'is_active' => true,
        ]);
         app(AuditService::class)->log(
        'Staff Account Created',
        'User',
         $user->id,
        'Created staff account for ' . $user->email,
        $request->user()->id
        );
        return response()->json([
            'message' => 'Staff account created successfully.',
            'user' => $user->load('role', 'hostel'),
        ], 201);
    }

    // Get all staff accounts
    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $users = User::with('role', 'hostel')
            ->whereHas('role', function ($query) {
                $query->whereIn('name', [
                    'Admin',
                    'Residential Warden',
                    'Chief Warden',
                    'Director'
                ]);
            })
            ->get();

        return response()->json([
            'users' => $users
        ]);
    }

    // Activate or deactivate a staff account
    public function updateStatus(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'is_active' => 'required|boolean',
        ]);

        $user = User::findOrFail($id);

        if (!$user->role || $user->role->name === 'Student') {
            return response()->json([
                'message' => 'Invalid staff account.'
            ], 422);
        }

        $user->update([
            'is_active' => $data['is_active'],
        ]);
        app(AuditService::class)->log(
        $data['is_active'] ? 'Account Activated' : 'Account Deactivated',
        'User',
        $user->id,
        'Account status changed to ' . ($data['is_active'] ? 'Active' : 'Inactive'),
        $request->user()->id
        );

        return response()->json([
            'message' => 'Account status updated successfully.',
            'user' => $user->load('role', 'hostel'),
        ]);
    }
}
