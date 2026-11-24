<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Services\AuditService;

class HostelController extends Controller
{
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Only Admin can manage hostels.'
            ], 403);
        }

        return null;
    }

    private function checkViewAccess(Request $request)
    {
        $role = $request->user()->role?->name;

        $allowedRoles = [
            'Admin',
            'Residential Warden',
            'Chief Warden',
            'Director',
            'Caretaker Operator',
        ];

        if (!in_array($role, $allowedRoles, true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($role === 'Residential Warden' && !$request->user()->hostel_id) {
            return response()->json([
                'message' => 'No hostel is assigned to this warden.'
            ], 403);
        }

        return null;
    }

    public function store(Request $request)
    {
        if ($response = $this->checkAdmin($request)) return $response;

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:hostels,code'],
            'address' => ['nullable', 'string', 'max:1000'],
        ]);

        $hostel = Hostel::create($data);

        app(AuditService::class)->log(
            'Hostel Created', 'Hostel', $hostel->id,
            'Created hostel ' . $hostel->name, $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Hostel created successfully.',
            'hostel' => $hostel,
        ], 201);
    }

    public function index(Request $request)
    {
        if ($response = $this->checkViewAccess($request)) return $response;

        $query = Hostel::withCount(['rooms', 'students']);

        if ($request->user()->role?->name === 'Residential Warden') {
            $query->where('id', $request->user()->hostel_id);
        }

        $hostels = $query->latest()->get();

        return response()->json([
            'success' => true,
            'total' => $hostels->count(),
            'hostels' => $hostels,
        ]);
    }

    public function show(Request $request, $id)
    {
        if ($response = $this->checkViewAccess($request)) return $response;

        $user = $request->user();

        if (
            $user->role?->name === 'Residential Warden' &&
            (int) $user->hostel_id !== (int) $id
        ) {
            return response()->json([
                'message' => 'You can only access your assigned hostel.'
            ], 403);
        }

        $hostel = Hostel::with([
            'rooms' => function ($query) {
                $query->withCount('students');
            },
            'students.user',
            'students.room',
        ])->withCount(['rooms', 'students'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'hostel' => $hostel,
        ]);
    }

    public function rooms(Request $request, $id)
    {
        if ($response = $this->checkViewAccess($request)) return $response;

        $hostel = Hostel::findOrFail($id);

        $rooms = \App\Models\Room::where('hostel_id', $hostel->id)
            ->withCount('students')
            ->get()
            ->map(function ($r) {
                return [
                    'id' => (string) $r->id,
                    'hostelId' => (string) $r->hostel_id,
                    'block' => 'Block A',
                    'roomNumber' => $r->room_number,
                    'capacity' => $r->capacity,
                    'currentOccupancy' => $r->students_count,
                    'availableBeds' => max(0, $r->capacity - $r->students_count),
                    'isFull' => $r->students_count >= $r->capacity,
                ];
            });

        return response()->json([
            'success' => true,
            'hostelId' => (string) $hostel->id,
            'totalRooms' => $rooms->count(),
            'rooms' => $rooms,
        ]);
    }

    public function allocateRoom(Request $request)
    {
        $data = $request->validate([
            'studentId' => ['required'],
            'hostelId' => ['required'],
            'roomNumber' => ['required', 'string'],
            'bedNumber' => ['nullable', 'string'],
        ]);

        $student = \App\Models\Student::findOrFail($data['studentId']);
        $room = \App\Models\Room::where('hostel_id', $data['hostelId'])
            ->where('room_number', $data['roomNumber'])
            ->firstOrFail();

        $student->update([
            'hostel_id' => $data['hostelId'],
            'room_id' => $room->id,
            'bed_number' => $data['bedNumber'] ?? 'A',
        ]);

        $student->user?->update(['hostel_id' => $data['hostelId']]);

        app(AuditService::class)->log(
            'Room Allocated',
            'Student',
            $student->id,
            'Allocated room ' . $room->room_number . ' in hostel ' . $data['hostelId'],
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Room allocated successfully.',
            'student' => $student->fresh()->load('user', 'hostel', 'room'),
        ]);
    }

    public function checkout(Request $request)
    {
        $data = $request->validate([
            'studentId' => ['required'],
            'clearanceNotes' => ['nullable', 'string'],
        ]);

        $student = \App\Models\Student::findOrFail($data['studentId']);

        app(AuditService::class)->log(
            'Student Hostel Checkout',
            'Student',
            $student->id,
            'Student checked out: ' . ($data['clearanceNotes'] ?? 'Clearance approved'),
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Student checkout clearance recorded successfully.',
            'student' => $student->load('user', 'hostel', 'room'),
        ]);
    }

    public function update(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) return $response;

        $hostel = Hostel::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'code' => [
                'sometimes', 'required', 'string', 'max:50',
                Rule::unique('hostels', 'code')->ignore($hostel->id),
            ],
            'address' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        $hostel->update($data);

        app(AuditService::class)->log(
            'Hostel Updated', 'Hostel', $hostel->id,
            'Updated hostel ' . $hostel->name, $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Hostel updated successfully.',
            'hostel' => $hostel->fresh()->loadCount(['rooms', 'students']),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) return $response;

        $hostel = Hostel::withCount(['rooms', 'students'])->findOrFail($id);

        if ($hostel->rooms_count > 0 || $hostel->students_count > 0) {
            return response()->json([
                'message' => 'This hostel cannot be deleted while rooms or students are assigned.',
                'rooms_count' => $hostel->rooms_count,
                'students_count' => $hostel->students_count,
            ], 422);
        }

        $name = $hostel->name;
        $hostelId = $hostel->id;
        $hostel->delete();

        app(AuditService::class)->log(
            'Hostel Deleted', 'Hostel', $hostelId,
            'Deleted hostel ' . $name, $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Hostel deleted successfully.',
        ]);
    }
}
