<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Services\AuditService;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Only Admin can manage rooms.',
            ], 403);
        }

        return null;
    }

    private function checkViewAccess(Request $request)
    {
        $user = $request->user();
        $role = $user->role?->name;

        $allowedRoles = [
            'Admin',
            'Residential Warden',
            'Warden',
            'Chief Warden',
            'Director',
            'Caretaker',
            'Caretaker Operator',
        ];

        if (! in_array($role, $allowedRoles, true)) {
            return response()->json([
                'message' => 'Unauthorized.',
            ], 403);
        }

        if ($user->isHostelScoped() && ! $user->hostel_id) {
            return response()->json([
                'message' => 'No hostel is assigned to this account.',
            ], 403);
        }

        return null;
    }

    // Create room
    public function store(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'hostel_id' => ['required', 'exists:hostels,id'],
            'room_number' => ['required', 'string', 'max:255'],
            'capacity' => ['required', 'integer', 'min:1'],
        ]);

        $exists = Room::where('hostel_id', $data['hostel_id'])
            ->where('room_number', $data['room_number'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'This room number already exists in this hostel.',
            ], 422);
        }

        $room = Room::create($data);

        app(AuditService::class)->log(
            'Room Created',
            'Room',
            $room->id,
            'Created room '.$room->room_number,
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Room created successfully.',
            'room' => $room->load('hostel')->loadCount('students'),
        ], 201);
    }

    // List rooms with occupant details
    public function index(Request $request)
    {
        if ($response = $this->checkViewAccess($request)) {
            return $response;
        }

        $query = Room::with([
            'hostel',
            'students.user',
        ])->withCount('students');

        if ($request->user()->isHostelScoped()) {
            $query->where('hostel_id', $request->user()->hostel_id);
        } elseif ($request->filled('hostel_id')) {
            $query->where('hostel_id', $request->hostel_id);
        }

        $rooms = $query->orderBy('room_number')->get();

        return response()->json([
            'success' => true,
            'total' => $rooms->count(),
            'rooms' => $rooms,
        ]);
    }

    // View single room
    public function show(Request $request, $id)
    {
        if ($response = $this->checkViewAccess($request)) {
            return $response;
        }

        $room = Room::with([
            'hostel',
            'students.user',
        ])->withCount('students')->findOrFail($id);

        if (
            $request->user()->isHostelScoped() &&
            (int) $room->hostel_id !== (int) $request->user()->hostel_id
        ) {
            return response()->json([
                'message' => 'You can only access rooms in your assigned hostel.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'room' => $room,
        ]);
    }

    // Update room
    public function update(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $room = Room::withCount('students')->findOrFail($id);

        $data = $request->validate([
            'hostel_id' => ['sometimes', 'required', 'exists:hostels,id'],
            'room_number' => ['sometimes', 'required', 'string', 'max:255'],
            'capacity' => ['sometimes', 'required', 'integer', 'min:1'],
        ]);

        $targetHostelId = $data['hostel_id'] ?? $room->hostel_id;
        $targetRoomNumber = $data['room_number'] ?? $room->room_number;

        $duplicate = Room::where('hostel_id', $targetHostelId)
            ->where('room_number', $targetRoomNumber)
            ->where('id', '!=', $room->id)
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'This room number already exists in this hostel.',
            ], 422);
        }

        if (
            isset($data['capacity']) &&
            $data['capacity'] < $room->students_count
        ) {
            return response()->json([
                'message' => 'Room capacity cannot be less than the current number of students.',
                'current_students' => $room->students_count,
                'requested_capacity' => $data['capacity'],
            ], 422);
        }

        $room->update($data);

        app(AuditService::class)->log(
            'Room Updated',
            'Room',
            $room->id,
            'Updated room '.$room->room_number,
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Room updated successfully.',
            'room' => $room->fresh()->load('hostel')->loadCount('students'),
        ]);
    }

    // Delete room
    public function destroy(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $room = Room::withCount('students')->findOrFail($id);

        if ($room->students_count > 0) {
            return response()->json([
                'message' => 'This room cannot be deleted while students are assigned.',
                'students_count' => $room->students_count,
            ], 422);
        }

        $roomNumber = $room->room_number;
        $roomId = $room->id;

        $room->delete();

        app(AuditService::class)->log(
            'Room Deleted',
            'Room',
            $roomId,
            'Deleted room '.$roomNumber,
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Room deleted successfully.',
        ]);
    }
}
