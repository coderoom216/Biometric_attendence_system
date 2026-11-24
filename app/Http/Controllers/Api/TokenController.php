<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Token;
use App\Models\Student;
use App\Models\Blacklist;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\AlertService;
use App\Services\AuditService;
use App\Services\ClockService;

class TokenController extends Controller
{
    private function checkStaff(Request $request)
    {
        $user = $request->user();
        $role = $user->role?->name;

        if (!in_array($role, [
            'Admin',
            'Residential Warden',
            'Chief Warden',
            'Director',
        ])) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if (
            $role === 'Residential Warden' &&
            empty($user->hostel_id)
        ) {
            return response()->json([
                'message' => 'Residential Warden has no assigned hostel.',
            ], 403);
        }

        return null;
    }

    // Issue token and check monthly blacklist limit
    public function store(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'student_id' => ['required', 'exists:students,id'],
            'token_count' => ['sometimes', 'required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $user = $request->user();

        $result = DB::transaction(function () use ($data, $user) {

            $student = Student::where('id', $data['student_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $user->role->name === 'Residential Warden' &&
                $student->hostel_id != $user->hostel_id
            ) {
                abort(403, 'You cannot issue tokens to another hostel student.');
            }

            $current = app(ClockService::class)->current();

            $today = $current->toDateString();

            $monthStart = $current->copy()
                ->startOfMonth()
                ->toDateString();

            $token = Token::create([
                'student_id' => $student->id,
                'issued_by' => $user->id,
                'token_count' => $data['token_count'] ?? 1,
                'reason' => $data['reason'],
                'issued_date' => $today,
                'month_start' => $monthStart,
            ]);

            $totalTokens = Token::where('student_id', $student->id)
                ->where('month_start', $monthStart)
                ->sum('token_count');

            app(AlertService::class)->checkStudentAlerts($student);

            $blacklist = null;

            // Blacklist only when monthly tokens exceed 10
            if ($totalTokens > 10) {
                $blacklist = Blacklist::firstOrNew([
                    'student_id' => $student->id,
                    'month_start' => $monthStart,
                ]);

                $blacklist->total_tokens = $totalTokens;
                $blacklist->status = 'active';

                if (!$blacklist->blacklisted_at) {
                    $blacklist->blacklisted_at = $current;
                }

                $blacklist->save();
            }

            return [
                'token' => $token,
                'total_tokens' => $totalTokens,
                'blacklist' => $blacklist,
            ];
        });

        app(AuditService::class)->log(
            'Token Issued',
            'Token',
            $result['token']->id,
            'Issued ' . $result['token']->token_count .
                ' token(s) to student ID ' . $result['token']->student_id,
            $user->id
        );

        if ($result['blacklist']) {
            app(AuditService::class)->log(
                $result['blacklist']->wasRecentlyCreated
                    ? 'Blacklist Created'
                    : 'Blacklist Updated',
                'Blacklist',
                $result['blacklist']->id,
                'Student ID ' . $result['blacklist']->student_id .
                    ' reached ' . $result['total_tokens'] . ' monthly tokens.',
                $user->id
            );
        }

        return response()->json([
            'message' => 'Token issued successfully.',
            'token' => $result['token'],
            'monthly_total' => $result['total_tokens'],
            'blacklisted' => $result['total_tokens'] > 10,
            'blacklist' => $result['blacklist'],
        ], 201);
    }

    // Staff views token records
    public function index(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $query = Token::with('student.user', 'issuedBy');

        $user = $request->user();

        if ($user->role->name === 'Residential Warden') {
            $query->whereHas('student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        return response()->json([
            'tokens' => $query->latest('issued_date')->get(),
        ]);
    }

    // Student views own token history
    public function myTokens(Request $request)
    {
        $user = $request->user();

        if ($user->role?->name !== 'Student') {
            return response()->json([
                'message' => 'Only students can view their token history.',
            ], 403);
        }

        $student = $user->student;

        if (!$student) {
            return response()->json([
                'message' => 'Student profile not found.',
            ], 404);
        }

        return response()->json([
            'tokens' => Token::where('student_id', $student->id)
                ->with('issuedBy')
                ->latest('issued_date')
                ->get(),
        ]);
    }
}
