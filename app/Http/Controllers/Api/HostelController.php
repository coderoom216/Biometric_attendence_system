<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use App\Models\Room;
use App\Models\Student;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HostelController extends Controller
{
    private function checkAdmin(Request $request)
    {
        if ($request->user()->role?->name !== 'Admin') {
            return response()->json([
                'message' => 'Only Admin can manage hostels.',
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

        if (! in_array($role, $allowedRoles, true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($role === 'Residential Warden' && ! $request->user()->hostel_id) {
            return response()->json([
                'message' => 'No hostel is assigned to this warden.',
            ], 403);
        }

        return null;
    }

    public function store(Request $request)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:hostels,code'],
            'address' => ['nullable', 'string', 'max:1000'],
        ]);

        $hostel = Hostel::create($data);

        app(AuditService::class)->log(
            'Hostel Created', 'Hostel', $hostel->id,
            'Created hostel '.$hostel->name, $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Hostel created successfully.',
            'hostel' => $hostel,
        ], 201);
    }

    public function index(Request $request)
    {
        if ($response = $this->checkViewAccess($request)) {
            return $response;
        }

        $query = Hostel::withCount(['rooms', 'students']);

        if ($request->user()->role?->name === 'Residential Warden') {
            $query->where('id', $request->user()->hostel_id);
        }

        $hostels = $query->latest()->get()->map(function ($h) {
            $totalRooms = $h->rooms_count ?? $h->rooms()->count();
            $studentsCount = $h->students_count ?? $h->students()->count();
            $capacity = $totalRooms * 3;
            $isGirls = str_contains(strtolower($h->name), 'girl') || str_contains(strtolower($h->code), 'gh');

            return [
                'id' => (string) $h->id,
                'name' => $h->name,
                'code' => $h->code,
                'type' => $isGirls ? 'girls' : 'boys',
                'blocks' => ['Block A', 'Block B'],
                'totalFloors' => 3,
                'totalRooms' => $totalRooms,
                'capacity' => $capacity ?: 180,
                'currentOccupancy' => $studentsCount,
                'availableBeds' => max(0, ($capacity ?: 180) - $studentsCount),
                'chiefWarden' => 'Dr. Chief Warden',
                'residentialWarden' => $isGirls ? 'Dr. Kavita Tariyal' : ($h->id == 3 ? 'Dr. Pathak Sir' : 'Dr. Sati Sir'),
                'created_at' => $h->created_at,
                'updated_at' => $h->updated_at,
            ];
        });

        return response()->json([
            'success' => true,
            'total' => $hostels->count(),
            'hostels' => $hostels,
        ]);
    }

    public function show(Request $request, $id)
    {
        if ($response = $this->checkViewAccess($request)) {
            return $response;
        }

        $user = $request->user();

        if (
            $user->role?->name === 'Residential Warden' &&
            (int) $user->hostel_id !== (int) $id
        ) {
            return response()->json([
                'message' => 'You can only access your assigned hostel.',
            ], 403);
        }

        $h = Hostel::with([
            'rooms' => function ($query) {
                $query->withCount('students');
            },
            'students.user',
            'students.room',
        ])->withCount(['rooms', 'students'])->findOrFail($id);

        $totalRooms = $h->rooms_count ?? $h->rooms()->count();
        $studentsCount = $h->students_count ?? $h->students()->count();
        $capacity = $totalRooms * 3;
        $isGirls = str_contains(strtolower($h->name), 'girl') || str_contains(strtolower($h->code), 'gh');

        $hostelData = [
            'id' => (string) $h->id,
            'name' => $h->name,
            'code' => $h->code,
            'type' => $isGirls ? 'girls' : 'boys',
            'blocks' => ['Block A', 'Block B'],
            'totalFloors' => 3,
            'totalRooms' => $totalRooms,
            'capacity' => $capacity ?: 180,
            'currentOccupancy' => $studentsCount,
            'availableBeds' => max(0, ($capacity ?: 180) - $studentsCount),
            'chiefWarden' => 'Dr. Chief Warden',
            'residentialWarden' => $isGirls ? 'Dr. Kavita Tariyal' : ($h->id == 3 ? 'Dr. Pathak Sir' : 'Dr. Sati Sir'),
            'rooms' => $h->rooms,
            'students' => $h->students,
            'created_at' => $h->created_at,
            'updated_at' => $h->updated_at,
        ];

        return response()->json([
            'success' => true,
            'hostel' => $hostelData,
        ]);
    }

    public function rooms(Request $request, $id)
    {
        if ($response = $this->checkViewAccess($request)) {
            return $response;
        }

        $hostel = Hostel::findOrFail($id);

        $rooms = Room::where('hostel_id', $hostel->id)
            ->with(['students.user'])
            ->withCount('students')
            ->orderByRaw('CAST(room_number AS UNSIGNED) ASC, room_number ASC')
            ->get()
            ->map(function ($r) {
                $capacity = max(1, (int) $r->capacity);
                $occupiedCount = (int) $r->students_count;
                $availableBeds = max(0, $capacity - $occupiedCount);
                $isFull = $occupiedCount >= $capacity;

                // Standard bed labels for capacity: ['A', 'B', 'C']
                $standardBeds = array_map(fn ($idx) => chr(65 + $idx), range(0, $capacity - 1));

                // Beds already occupied in this room
                $takenBeds = $r->students
                    ->pluck('bed_number')
                    ->map(fn ($b) => strtoupper(trim(str_replace(['Bed', 'bed', ' '], '', (string) $b))))
                    ->filter()
                    ->all();

                // Compute vacant beds
                $vacantBeds = array_values(array_filter($standardBeds, fn ($b) => ! in_array($b, $takenBeds, true)));
                if (empty($vacantBeds) && $availableBeds > 0) {
                    $vacantBeds = array_slice($standardBeds, $occupiedCount, $availableBeds);
                }

                return [
                    'id' => (string) $r->id,
                    'hostelId' => (string) $r->hostel_id,
                    'block' => 'Block A',
                    'roomNumber' => $r->room_number,
                    'capacity' => $capacity,
                    'currentOccupancy' => $occupiedCount,
                    'availableBeds' => $availableBeds,
                    'isFull' => $isFull,
                    'isVacant' => ! $isFull && $availableBeds > 0,
                    'vacantBeds' => $vacantBeds,
                    'occupants' => $r->students->map(fn ($s) => [
                        'id' => (string) $s->id,
                        'name' => $s->user?->name ?? 'Student '.$s->enrollment_no,
                        'enrollmentNo' => $s->enrollment_no,
                        'bedNumber' => $s->bed_number ?? 'A',
                    ]),
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

        $student = Student::findOrFail($data['studentId']);
        $room = Room::where('hostel_id', $data['hostelId'])
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
            'Allocated room '.$room->room_number.' in hostel '.$data['hostelId'],
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

        $student = Student::findOrFail($data['studentId']);

        app(AuditService::class)->log(
            'Student Hostel Checkout',
            'Student',
            $student->id,
            'Student checked out: '.($data['clearanceNotes'] ?? 'Clearance approved'),
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
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

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
            'Updated hostel '.$hostel->name, $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Hostel updated successfully.',
            'hostel' => $hostel->fresh()->loadCount(['rooms', 'students']),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

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
            'Deleted hostel '.$name, $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Hostel deleted successfully.',
        ]);
    }
}
