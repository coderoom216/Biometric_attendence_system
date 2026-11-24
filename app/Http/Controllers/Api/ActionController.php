<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Action;
use App\Models\Ticket;
use Illuminate\Http\Request;
use App\Services\AuditService;

class ActionController extends Controller
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

    public function store(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'ticket_id' => ['required', 'exists:tickets,id'],
            'action_taken' => ['required', 'string'],
            'action_date' => ['required', 'date'],
        ]);

        $user = $request->user();

        $query = Ticket::with('violation.student');

        if ($user->role->name === 'Residential Warden') {
            $query->whereHas('violation.student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $ticket = $query->findOrFail($data['ticket_id']);

        $action = Action::create([
            'ticket_id' => $ticket->id,
            'action_taken' => $data['action_taken'],
            'action_date' => $data['action_date'],
            'user_id' => $user->id,
        ]);

        app(AuditService::class)->log(
            'Action Recorded',
            'Action',
            $action->id,
            'Action recorded against ticket ID ' . $ticket->id,
            $user->id
        );

        return response()->json([
            'message' => 'Action recorded successfully.',
            'action' => $action,
        ], 201);
    }
}
