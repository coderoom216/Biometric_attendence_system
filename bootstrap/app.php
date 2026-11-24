<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use App\Http\Middleware\HandleInertiaRequests;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {

        // Enable Sanctum stateful API authentication
        $middleware->statefulApi();

        // Register Inertia middleware
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);

        // Existing guest redirect
        $middleware->redirectGuestsTo(function ($request) {
            if ($request->is('api/*')) {
                return null;
            }

            return route('login');
        });
    })
    ->withExceptions(function (Exceptions $exceptions): void {

        // Existing API JSON exception handling
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, Throwable $e) =>
                $request->is('api/*') || $request->expectsJson()
        );

    })->create();

