<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Hostel;
use App\Models\Student;
use App\Services\ClockService;
use App\Services\DefaulterEvaluationService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(
        private ClockService $clockService,
        private DefaulterEvaluationService $evaluationService
    ) {}

    public function summary(Request $request)
    {
        $date = $request->query('date', $this->clockService->current()->toDateString());
        $this->evaluationService->ensureEvaluatedForDate($date);

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
        $endDateParam = $request->query('date');
        $current = $endDateParam
            ? Carbon::parse($endDateParam, ClockService::TIMEZONE)
            : $this->clockService->current();
        $hostels = Hostel::all();
        $studentsByHostel = $hostels->mapWithKeys(function (Hostel $hostel) {
            return [$hostel->id => Student::where('hostel_id', $hostel->id)->pluck('id')];
        });
        $totalEnrolled = Student::verified()->count();
        $trends = [];

        for ($i = 6; $i >= 0; $i--) {
            $dCarbon = $current->copy()->subDays($i);
            $d = $dCarbon->toDateString();
            $this->evaluationService->ensureEvaluatedForDate($d);

            $records = Attendance::whereDate('attendance_date', $d)->get();
            $pres = $records->where('status', 'present')->count();
            $late = $records->where('status', 'late')->count();
            $leave = $records->where('status', 'approved_leave')->count();
            $def = $records->where('is_defaulter', true)->count();

            $hostelBreakdown = $hostels->map(function (Hostel $hostel) use ($records, $studentsByHostel) {
                $ids = $studentsByHostel->get($hostel->id, collect());
                $hRecords = $records->whereIn('student_id', $ids);

                return [
                    'hostelId' => (string) $hostel->id,
                    'hostelName' => $hostel->name,
                    'code' => $hostel->code ?? ('H'.$hostel->id),
                    'enrolled' => $ids->count(),
                    'present' => $hRecords->where('status', 'present')->count(),
                    'late' => $hRecords->where('status', 'late')->count(),
                    'leave' => $hRecords->where('status', 'approved_leave')->count(),
                    'defaulters' => $hRecords->where('is_defaulter', true)->count(),
                ];
            })->values();

            $trends[] = [
                'isoDate' => $d,
                'date' => $dCarbon->format('M d'),
                'label' => $dCarbon->format('D, M j'),
                'enrolled' => $totalEnrolled,
                'present' => $pres,
                'late' => $late,
                'leave' => $leave,
                'defaulters' => $def,
                'hostels' => $hostelBreakdown,
            ];
        }

        return response()->json([
            'success' => true,
            'date' => $current->toDateString(),
            'trends' => $trends,
        ]);
    }
}
