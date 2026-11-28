<?php

use App\Http\Controllers\Api\ActionController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EvaluationController;
use App\Http\Controllers\Api\ExecutionController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ScheduledTaskController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\TokenController;
use App\Http\Controllers\Api\ViolationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::post('/forgot-password', [
    AuthController::class,
    'forgotPassword',
]);

Route::post('/reset-password', [
    AuthController::class,
    'resetPassword',
]);

Route::middleware('auth:sanctum')->group(function () {

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::post('/logout', [AuthController::class, 'logout']);

    // Admin Routes
    Route::post('/admin/users', [AdminController::class, 'storeUser']);
    Route::get('/admin/users', [AdminController::class, 'index']);
    Route::patch('/admin/users/{id}/status', [AdminController::class, 'updateStatus']);

    // Student Routes
    Route::post('/admin/students', [StudentController::class, 'store']);
    Route::get('/admin/students', [StudentController::class, 'index']);
    Route::get('/students/{id}', [StudentController::class, 'show']);
    Route::put('/admin/students/{id}', [StudentController::class, 'update']);
    // Leave Routes
    Route::post('/leaves', [LeaveController::class, 'store']);
    Route::get('/leaves/my', [LeaveController::class, 'myLeaves']);
    Route::get('/admin/leaves', [LeaveController::class, 'index']);
    Route::patch('/admin/leaves/{id}/status', [LeaveController::class, 'updateStatus']);
    // Violation Routes
    Route::post('/admin/violations', [ViolationController::class, 'store']);
    Route::get('/admin/violations', [ViolationController::class, 'index']);
    Route::get('/admin/violations/{id}', [ViolationController::class, 'show']);
    // Action Routes
    Route::post('/admin/actions', [ActionController::class, 'store']);
    // Token Routes
    Route::post('/admin/tokens', [TokenController::class, 'store']);
    Route::get('/admin/tokens', [TokenController::class, 'index']);
    Route::get('/tokens/my', [TokenController::class, 'myTokens']);
    // Alert Routes
    Route::get('/admin/alerts', [AlertController::class, 'index']);
    Route::get('/alerts/my', [AlertController::class, 'myAlerts']);
    Route::patch('/admin/alerts/{id}/status', [AlertController::class, 'updateStatus']);

    // Notification Routes
    Route::post('/admin/notifications', [NotificationController::class, 'store']);
    Route::get('/admin/notifications', [NotificationController::class, 'index']);
    Route::patch('/admin/notifications/{id}/status', [NotificationController::class, 'updateStatus']);

    // Scheduled Task Routes
    Route::post('/admin/scheduled-tasks', [ScheduledTaskController::class, 'store']);
    Route::get('/admin/scheduled-tasks', [ScheduledTaskController::class, 'index']);
    Route::put('/admin/scheduled-tasks/{id}', [ScheduledTaskController::class, 'update']);
    Route::delete('/admin/scheduled-tasks/{id}', [ScheduledTaskController::class, 'destroy']);
    // Execution Routes
    Route::post('/admin/executions', [ExecutionController::class, 'store']);
    Route::get('/admin/executions', [ExecutionController::class, 'index']);
    Route::get('/admin/executions/{id}', [ExecutionController::class, 'show']);
    Route::put('/admin/executions/{id}', [ExecutionController::class, 'update']);
    // Evaluation Routes
    Route::post('/admin/evaluations', [EvaluationController::class, 'store']);
    Route::get('/admin/evaluations', [EvaluationController::class, 'index']);
    Route::get('/admin/evaluations/{id}', [EvaluationController::class, 'show']);
    Route::put('/admin/evaluations/{id}', [EvaluationController::class, 'update']);
    // Audit Routes
    Route::get('/admin/audits', [AuditController::class, 'index']);
    Route::get('/admin/audits/{id}', [AuditController::class, 'show']);
});
