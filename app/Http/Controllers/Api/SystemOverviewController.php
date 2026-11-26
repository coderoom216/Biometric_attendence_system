<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Device;
use App\Models\Hostel;
use App\Models\Student;
use App\Services\ClockService;
use Illuminate\Http\Request;

class SystemOverviewController extends Controller
{
    public function __construct(
        private ClockService $clockService
    ) {}

    public function overview(Request $request)
    {
        $user = $request->user();
        $role = $user?->role?->name;
        if (! in_array($role, ['Admin', 'Director', 'Chief Warden', 'Residential Warden', 'Warden', 'Caretaker', 'Caretaker Operator'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        $current = $this->clockService->current();
        $date = $current->toDateString();

        $isScoped = $user->isHostelScoped();
        $scopedHostelId = $user->hostel_id;

        $totalStudents = Student::verified()
            ->when($isScoped, fn ($q) => $q->where('hostel_id', $scopedHostelId))
            ->count();
        $totalHostels = $isScoped ? ($scopedHostelId ? 1 : 0) : Hostel::count();
        $totalDevices = Device::when($isScoped, fn ($q) => $q->where('hostel_id', $scopedHostelId))->count();
        $activeDevices = Device::where('device_status', 'active')
            ->when($isScoped, fn ($q) => $q->where('hostel_id', $scopedHostelId))
            ->count();

        $todayAttendance = Attendance::whereDate('attendance_date', $date)
            ->when($isScoped, fn ($q) => $q->whereHas('student', fn ($sq) => $sq->where('hostel_id', $scopedHostelId)))
            ->get();
        $present = $todayAttendance->where('status', 'present')->count();
        $late = $todayAttendance->where('status', 'late')->count();
        $defaulters = $todayAttendance->where('is_defaulter', true)->count();

        return response()->json([
            'success' => true,
            'virtualDate' => $date,
            'virtualTime' => $current->format('H:i:s'),
            'isPastCutoff' => $this->clockService->isPastCutoff(),
            'isPastDefaulterTime' => $this->clockService->isPastDefaulterTime(),
            'stats' => [
                'totalStudents' => $totalStudents,
                'totalHostels' => $totalHostels,
                'totalDevices' => $totalDevices,
                'activeDevices' => $activeDevices,
                'todayPresent' => $present,
                'todayLate' => $late,
                'todayDefaulters' => $defaulters,
            ],
        ]);
    }
}
