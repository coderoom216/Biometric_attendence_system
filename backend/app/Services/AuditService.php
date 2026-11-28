<?php

namespace App\Services;

use App\Models\Audit;
use Illuminate\Support\Facades\Auth;

class AuditService
{
    public function log(
        string $activity,
        string $entityType,
        ?int $entityId = null,
        ?string $details = null,
        ?int $userId = null
    ): Audit {
        return Audit::create([
            'user_id' => $userId ?? Auth::id(),
            'activity' => $activity,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'details' => $details,
            'activity_at' => now(),
        ]);
    }
}
