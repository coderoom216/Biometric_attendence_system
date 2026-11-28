<?php

use Illuminate\Support\Facades\Route;

Route::get('/reset-password/{token}', function (string $token) {
    return response()->json([
        'message' => 'Reset password page endpoint',
        'token' => $token,
    ]);
})->name('password.reset');
