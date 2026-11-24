<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Hostel;
use App\Models\Student;
use App\Services\ClockService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(
        private ClockService $clockService
    ) {}

    public function summary(Request $request)
    {
        $date = $request->query('date', $this->clockService->current()->toDateString());

        $hostels = Hostel::withCount('students')->get();
        $totalStudents = Student::verified()->count();

        $attendances = Attendance::whereDate('attendance_date', $date)->get();
        $present = $attendances->where('status', 'present')->count();
        $late = $attendances->where('status', 'late')->count();
        $leave = $attendances->where('status', 'approved_leave')->count();
        $defaulters = $attendances->where('is_defaulter', true)->count();
        $absent = max(0, $totalStudents - ($present + $late + $leave));

        $hostelReports = $hostels->map(function ($hostel) use ($date) {
            $studentIds = Student::where('hostel_id', $hostel->id)->pluck('id');
            $hAttendances = Attendance::whereIn('student_id', $studentIds)
                ->whereDate('attendance_date', $date)
                ->get();

            $total = $studentIds->count();
            $pres = $hAttendances->where('status', 'present')->count();
            $lt = $hAttendances->where('status', 'late')->count();
            $lv = $hAttendances->where('status', 'approved_leave')->count();
            $def = $hAttendances->where('is_defaulter', true)->count();

            return [
                'hostelId' => (string) $hostel->id,
                'hostelName' => $hostel->name,
                'code' => $hostel->code ?? ('H'.$hostel->id),
                'totalResidents' => $total,
                'totalEnrolled' => $total,
                'presentCount' => $pres,
                'present' => $pres,
                'lateCount' => $lt,
                'late' => $lt,
                'leaveCount' => $lv,
                'leave' => $lv,
                'defaulterCount' => $def,
                'defaulters' => $def,
                'complianceRate' => $total > 0 ? round((($pres + $lt) / $total) * 100, 1) : 0,
                'attendancePercentage' => $total > 0 ? round((($pres + $lt) / $total) * 100, 1) : 0,
            ];
        });

        return response()->json([
            'success' => true,
            'date' => $date,
            'consolidated' => [
                'totalStudents' => $totalStudents,
                'totalEnrolled' => $totalStudents,
                'presentCount' => $present,
                'totalPresent' => $present,
                'lateCount' => $late,
                'totalLate' => $late,
                'leaveCount' => $leave,
                'totalLeave' => $leave,
                'defaultersCount' => $defaulters,
                'totalDefaulters' => $defaulters,
                'overallPercentage' => $totalStudents > 0 ? round((($present + $late) / $totalStudents) * 100, 1) : 0,
            ],
            'hostelReports' => $hostelReports,
        ]);
    }

    public function trends(Request $request)
    {
        $current = $this->clockService->current();
        $trends = [];

        for ($i = 6; $i >= 0; $i--) {
            $d = $current->copy()->subDays($i)->toDateString();
            $records = Attendance::whereDate('attendance_date', $d)->get();
            $pres = $records->where('status', 'present')->count();
            $late = $records->where('status', 'late')->count();
            $def = $records->where('is_defaulter', true)->count();

            $trends[] = [
                'date' => Carbon::parse($d)->format('M d'),
                'present' => $pres,
                'late' => $late,
                'defaulters' => $def,
            ];
        }

        return response()->json([
            'success' => true,
            'trends' => $trends,
        ]);
    }
}
