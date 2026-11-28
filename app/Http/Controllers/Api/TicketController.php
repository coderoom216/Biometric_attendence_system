<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Services\AuditService;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    private function checkStaff(Request $request)
    {
        $user = $request->user();
        $role = $user->role?->name;

        if (! in_array($role, [
            'Admin',
            'Residential Warden',
            'Warden',
            'Chief Warden',
            'Director',
            'Caretaker',
        ], true)) {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        if (
            $user->isHostelScoped() &&
            empty($user->hostel_id)
        ) {
            return response()->json([
                'message' => "{$role} has no assigned hostel.",
            ], 403);
        }

        return null;
    }

    public function index(Request $request)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $query = Ticket::with([
            'violation.student.user',
            'actions.user',
        ]);

        $user = $request->user();

        if ($user->isHostelScoped()) {
            $query->whereHas('violation.student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        return response()->json([
            'tickets' => $query->latest()->get(),
        ]);
    }

    public function show(Request $request, $id)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $user = $request->user();

        $query = Ticket::with([
            'violation.student.user',
            'actions.user',
        ]);

        if ($user->isHostelScoped()) {
            $query->whereHas('violation.student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $ticket = $query->findOrFail($id);

        return response()->json([
            'ticket' => $ticket,
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        if ($response = $this->checkStaff($request)) {
            return $response;
        }

        $data = $request->validate([
            'warning_status' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();

        $query = Ticket::query();

        if ($user->isHostelScoped()) {
            $query->whereHas('violation.student', function ($q) use ($user) {
                $q->where('hostel_id', $user->hostel_id);
            });
        }

        $ticket = $query->findOrFail($id);

        $oldStatus = $ticket->warning_status;

        $ticket->update([
            'warning_status' => $data['warning_status'],
        ]);

        app(AuditService::class)->log(
            'Ticket Status Updated',
            'Ticket',
            $ticket->id,
            'Ticket status changed from '.$oldStatus.
                ' to '.$ticket->warning_status,
            $user->id
        );

        return response()->json([
            'message' => 'Ticket status updated successfully.',
            'ticket' => $ticket,
        ]);
    }
}
