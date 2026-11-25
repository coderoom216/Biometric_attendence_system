<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Action;
use App\Models\Ticket;
use App\Services\AuditService;
use Illuminate\Http\Request;

class ActionController extends Controller
{
    // Check staff access
    private function checkStaff(Request $request)
    {
        $role = $request->user()->role?->name;

        if (! in_array($role, [
            'Admin',
            'Residential Warden',
            'Chief Warden',
            'Director',
        ])) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        return null;
    }

    // Create action against ticket
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

        $ticket = Ticket::with('violation.student')
            ->findOrFail($data['ticket_id']);

        $user = $request->user();

        // Residential Warden can manage only assigned hostel
        if (
            $user->role->name === 'Residential Warden' &&
            $ticket->violation->student->hostel_id != $user->hostel_id
        ) {
            return response()->json([
                'message' => 'You cannot manage tickets for another hostel.',
            ], 403);
        }

        $data['user_id'] = $user->id;

        $action = Action::create($data);

        app(AuditService::class)->log(
            'Action Recorded',
            'Action',
            $action->id,
            'Action recorded against ticket ID '.$ticket->id,
            $user->id
        );

        return response()->json([
            'message' => 'Action recorded successfully.',
            'action' => $action,
        ], 201);
    }
}
