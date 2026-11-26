<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    private const STAFF_ROLES = [
        'Admin',
        'Residential Warden',
        'Warden',
        'Chief Warden',
        'Director',
        'Caretaker',
        'Caretaker Operator',
    ];

    private const HOSTEL_SCOPED_ROLES = [
        'Residential Warden',
        'Warden',
        'Caretaker',
    ];

    private function checkAdmin(Request $request)
    {
        if (
            ! $request->user() ||
            $request->user()->role?->name !== 'Admin'
        ) {
            return response()->json([
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        return null;
    }

    public function storeUser(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role_id' => [
                'required',
                Rule::exists('roles', 'id')->whereIn(
                    'name',
                    self::STAFF_ROLES
                ),
            ],
            'hostel_id' => ['nullable', 'exists:hostels,id'],
        ]);

        $role = Role::findOrFail($data['role_id']);

        if (
            in_array($role->name, self::HOSTEL_SCOPED_ROLES, true) &&
            empty($data['hostel_id'])
        ) {
            return response()->json([
                'message' => "{$role->name} must be assigned a hostel.",
            ], 422);
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role_id' => $role->id,
            'hostel_id' => in_array($role->name, self::HOSTEL_SCOPED_ROLES, true)
                ? $data['hostel_id']
                : null,
            'is_active' => true,
        ]);

        app(AuditService::class)->log(
            'Staff Account Created',
            'User',
            $user->id,
            'Created staff account for '.$user->email,
            $request->user()->id
        );

        return response()->json([
            'message' => 'Staff account created successfully.',
            'user' => $user->load('role', 'hostel'),
        ], 201);
    }

    public function index(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $users = User::with('role', 'hostel')
            ->whereHas('role', function ($query) {
                $query->whereIn('name', self::STAFF_ROLES);
            })
            ->orderBy('name')
            ->get();

        return response()->json([
            'users' => $users,
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $user = User::with('role')->findOrFail($id);

        if (
            ! $user->role ||
            $user->role->name === 'Student'
        ) {
            return response()->json([
                'message' => 'Invalid staff account.',
            ], 422);
        }

        if (
            $user->id === $request->user()->id &&
            ! $data['is_active']
        ) {
            return response()->json([
                'message' => 'You cannot deactivate your own account.',
            ], 422);
        }

        $user->update([
            'is_active' => $data['is_active'],
        ]);

        app(AuditService::class)->log(
            $data['is_active'] ? 'Account Activated' : 'Account Deactivated',
            'User',
            $user->id,
            'Account status changed to '.
                ($data['is_active'] ? 'Active' : 'Inactive'),
            $request->user()->id
        );

        return response()->json([
            'message' => 'Account status updated successfully.',
            'user' => $user->load('role', 'hostel'),
        ]);
    }
}
