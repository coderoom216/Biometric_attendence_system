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
        $role = $request->user()?->role?->name;
        if (! in_array($role, ['Admin', 'Director', 'Chief Warden', 'Residential Warden', 'Warden', 'Caretaker Operator'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access.',
            ], 403);
        }

        $current = $this->clockService->current();
        $date = $current->toDateString();

        $totalStudents = Student::verified()->count();
        $totalHostels = Hostel::count();
        $totalDevices = Device::count();
        $activeDevices = Device::where('device_status', 'active')->count();

        $todayAttendance = Attendance::whereDate('attendance_date', $date)->get();
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
