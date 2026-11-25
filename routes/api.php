<?php

use App\Http\Controllers\Api\ActionController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BiometricController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\DeviceWebhookController;
use App\Http\Controllers\Api\EvaluationController;
use App\Http\Controllers\Api\ExecutionController;
use App\Http\Controllers\Api\HostelController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\ScheduledTaskController;
use App\Http\Controllers\Api\SchedulerController;
use App\Http\Controllers\Api\SecurityTestController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\SystemOverviewController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\TokenController;
use App\Http\Controllers\Api\ViolationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Authentication Routes
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// Password recovery compatibility routes
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// Public biometric device webhook (hardware integration handled separately)
Route::post('/device/webhook', [DeviceWebhookController::class, 'handle']);

/*
|--------------------------------------------------------------------------
| Authenticated API Routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    /*
    |--------------------------------------------------------------------------
    | Authentication
    |--------------------------------------------------------------------------
    */

    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });

    Route::post('/logout', [AuthController::class, 'logout']);

    /*
    |--------------------------------------------------------------------------
    | Admin Users
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/users', [AdminController::class, 'storeUser']);
    Route::get('/admin/users', [AdminController::class, 'index']);
    Route::patch('/admin/users/{id}/status', [AdminController::class, 'updateStatus']);

    /*
    |--------------------------------------------------------------------------
    | Students
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/students', [StudentController::class, 'store']);
    Route::get('/admin/students', [StudentController::class, 'index']);
    Route::get('/students/{id}', [StudentController::class, 'show']);
    Route::put('/admin/students/{id}', [StudentController::class, 'update']);
    Route::post('/admin/students/{id}/allocate-room', [StudentController::class, 'allocateRoom']);

    /*
    |--------------------------------------------------------------------------
    | Leaves
    |--------------------------------------------------------------------------
    */

    Route::post('/leaves', [LeaveController::class, 'store']);
    Route::get('/leaves/my', [LeaveController::class, 'myLeaves']);
    Route::get('/admin/leaves', [LeaveController::class, 'index']);
    Route::patch('/admin/leaves/{id}/status', [LeaveController::class, 'updateStatus']);

    /*
    |--------------------------------------------------------------------------
    | Violations
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/violations', [ViolationController::class, 'store']);
    Route::get('/admin/violations', [ViolationController::class, 'index']);
    Route::get('/admin/violations/{id}', [ViolationController::class, 'show']);

    /*
    |--------------------------------------------------------------------------
    | Actions
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/actions', [ActionController::class, 'store']);

    /*
    |--------------------------------------------------------------------------
    | Tickets
    |--------------------------------------------------------------------------
    */

    Route::get('/admin/tickets', [TicketController::class, 'index']);
    Route::get('/admin/tickets/{id}', [TicketController::class, 'show']);
    Route::patch('/admin/tickets/{id}/status', [TicketController::class, 'updateStatus']);

    /*
    |--------------------------------------------------------------------------
    | Tokens
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/tokens', [TokenController::class, 'store']);
    Route::get('/admin/tokens', [TokenController::class, 'index']);
    Route::get('/tokens/my', [TokenController::class, 'myTokens']);

    /*
    |--------------------------------------------------------------------------
    | Alerts
    |--------------------------------------------------------------------------
    */

    Route::get('/admin/alerts', [AlertController::class, 'index']);
    Route::get('/alerts/my', [AlertController::class, 'myAlerts']);
    Route::patch('/admin/alerts/{id}/status', [AlertController::class, 'updateStatus']);

    /*
    |--------------------------------------------------------------------------
    | Notifications
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/notifications', [NotificationController::class, 'store']);
    Route::get('/admin/notifications', [NotificationController::class, 'index']);
    Route::patch('/admin/notifications/{id}/status', [NotificationController::class, 'updateStatus']);

    /*
    |--------------------------------------------------------------------------
    | Scheduled Tasks
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/scheduled-tasks', [ScheduledTaskController::class, 'store']);
    Route::get('/admin/scheduled-tasks', [ScheduledTaskController::class, 'index']);
    Route::put('/admin/scheduled-tasks/{id}', [ScheduledTaskController::class, 'update']);
    Route::delete('/admin/scheduled-tasks/{id}', [ScheduledTaskController::class, 'destroy']);

    /*
    |--------------------------------------------------------------------------
    | Executions
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/executions', [ExecutionController::class, 'store']);
    Route::get('/admin/executions', [ExecutionController::class, 'index']);
    Route::get('/admin/executions/{id}', [ExecutionController::class, 'show']);
    Route::put('/admin/executions/{id}', [ExecutionController::class, 'update']);

    /*
    |--------------------------------------------------------------------------
    | Evaluations
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/evaluations', [EvaluationController::class, 'store']);
    Route::get('/admin/evaluations', [EvaluationController::class, 'index']);
    Route::get('/admin/evaluations/{id}', [EvaluationController::class, 'show']);
    Route::put('/admin/evaluations/{id}', [EvaluationController::class, 'update']);

    /*
    |--------------------------------------------------------------------------
    | Audits
    |--------------------------------------------------------------------------
    */

    Route::get('/admin/audits', [AuditController::class, 'index']);
    Route::get('/admin/audits/{id}', [AuditController::class, 'show']);

    /*
    |--------------------------------------------------------------------------
    | Hostels
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/hostels', [HostelController::class, 'store']);
    Route::get('/admin/hostels', [HostelController::class, 'index']);
    Route::get('/admin/hostels/{id}', [HostelController::class, 'show']);
    Route::put('/admin/hostels/{id}', [HostelController::class, 'update']);
    Route::delete('/admin/hostels/{id}', [HostelController::class, 'destroy']);

    /*
    |--------------------------------------------------------------------------
    | Rooms
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/rooms', [RoomController::class, 'store']);
    Route::get('/admin/rooms', [RoomController::class, 'index']);
    Route::get('/admin/rooms/{id}', [RoomController::class, 'show']);
    Route::put('/admin/rooms/{id}', [RoomController::class, 'update']);
    Route::delete('/admin/rooms/{id}', [RoomController::class, 'destroy']);

    /*
    |--------------------------------------------------------------------------
    | Devices
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/devices', [DeviceController::class, 'store']);
    Route::get('/admin/devices', [DeviceController::class, 'index']);
    Route::get('/admin/devices/{id}', [DeviceController::class, 'show']);
    Route::put('/admin/devices/{id}', [DeviceController::class, 'update']);
    Route::patch('/admin/devices/{id}/status', [DeviceController::class, 'updateStatus']);
    Route::delete('/admin/devices/{id}', [DeviceController::class, 'destroy']);

    /*
    |--------------------------------------------------------------------------
    | Attendance Tracking & Evaluation
    |--------------------------------------------------------------------------
    */

    Route::get('/attendance/today', [AttendanceController::class, 'today']);
    Route::get('/attendance/defaulters', [AttendanceController::class, 'defaulters']);
    Route::get('/attendance/late-punches', [AttendanceController::class, 'latePunches']);
    Route::post('/attendance/record-punch', [AttendanceController::class, 'recordPunch']);
    Route::post('/attendance/correct', [AttendanceController::class, 'correct']);
    Route::get('/attendance/history', [AttendanceController::class, 'history']);
    Route::get('/reports/export-attendance-csv', [AttendanceController::class, 'exportAttendance']);
    Route::get('/reports/export-defaulters-csv', [AttendanceController::class, 'exportDefaulters']);

    /*
    |--------------------------------------------------------------------------
    | Scheduler & Virtual Clock Simulation
    |--------------------------------------------------------------------------
    */

    Route::get('/scheduler/status', [SchedulerController::class, 'status']);
    Route::post('/scheduler/set-clock', [SchedulerController::class, 'setClock']);
    Route::post('/scheduler/evaluate-cutoff', [SchedulerController::class, 'evaluateCutoff']);

    /*
    |--------------------------------------------------------------------------
    | Biometric Hardware & Synchronization
    |--------------------------------------------------------------------------
    */

    Route::get('/biometric/devices', [BiometricController::class, 'devices']);
    Route::get('/biometric/enrolled-users', [BiometricController::class, 'enrolledUsers']);
    Route::post('/biometric/trigger-user-fetch', [BiometricController::class, 'triggerUserFetch']);
    Route::get('/biometric/live', [BiometricController::class, 'live']);
    Route::post('/biometric/sync', [BiometricController::class, 'sync']);
    Route::get('/biometric/health', [BiometricController::class, 'health']);

    /*
    |--------------------------------------------------------------------------
    | Students (Directory, Verification & Warning Tickets)
    |--------------------------------------------------------------------------
    */

    Route::get('/students', [StudentController::class, 'index']);
    Route::get('/students/warning-tickets', [StudentController::class, 'warningTickets']);
    Route::post('/students/onboard', [StudentController::class, 'store']);
    Route::post('/students/device-registration', [StudentController::class, 'deviceRegistration']);
    Route::post('/students/verify', [StudentController::class, 'verify']);
    Route::post('/students/submit-registration', [StudentController::class, 'submitRegistration']);

    /*
    |--------------------------------------------------------------------------
    | Leaves (Staff & Warden Entry)
    |--------------------------------------------------------------------------
    */

    Route::get('/leaves', [LeaveController::class, 'index']);
    Route::post('/leaves/enter', [LeaveController::class, 'enter']);

    /*
    |--------------------------------------------------------------------------
    | Hostels & Rooms
    |--------------------------------------------------------------------------
    */

    Route::get('/hostels', [HostelController::class, 'index']);
    Route::get('/hostels/{id}/rooms', [HostelController::class, 'rooms']);
    Route::post('/hostels/allocate-room', [HostelController::class, 'allocateRoom']);
    Route::post('/hostels/checkout', [HostelController::class, 'checkout']);

    /*
    |--------------------------------------------------------------------------
    | Notifications & Retry
    |--------------------------------------------------------------------------
    */

    Route::get('/notifications/logs', [NotificationController::class, 'index']);
    Route::post('/notifications/retry', [NotificationController::class, 'retry']);

    /*
    |--------------------------------------------------------------------------
    | System Overview, Reports & Security Audit Tests
    |--------------------------------------------------------------------------
    */

    Route::get('/reports/summary', [ReportController::class, 'summary']);
    Route::get('/reports/trends', [ReportController::class, 'trends']);
    Route::get('/system/audit-logs', [AuditController::class, 'index']);
    Route::get('/system/overview', [SystemOverviewController::class, 'overview']);
    Route::get('/security-test/run', [SecurityTestController::class, 'run']);
});
