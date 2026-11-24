<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes - Single Page Application (SPA)
|--------------------------------------------------------------------------
|
| All web traffic is routed to the root Blade view ('app'), which loads
| the compiled React frontend via Laravel Vite. Client-side navigation
| is managed by React Router. API requests (/api/*) are handled in routes/api.php.
|
*/

Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
