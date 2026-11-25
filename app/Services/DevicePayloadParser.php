<?php

namespace App\Services;

class DevicePayloadParser
{
    /**
     * Extract the first complete JSON object from a device payload.
     */
    public function extractLeadingJson(string $raw): ?array
    {
        $start = strpos($raw, '{');

        if ($start === false) {
            return null;
        }

        $depth = 0;
        $inString = false;
        $escaped = false;

        for ($i = $start, $length = strlen($raw); $i < $length; $i++) {
            $char = $raw[$i];

            if ($inString) {
                if ($escaped) {
                    $escaped = false;
                } elseif ($char === '\\') {
                    $escaped = true;
                } elseif ($char === '"') {
                    $inString = false;
                }

                continue;
            }

            if ($char === '"') {
                $inString = true;
            } elseif ($char === '{') {
                $depth++;
            } elseif ($char === '}') {
                $depth--;

                if ($depth === 0) {
                    $json = substr($raw, $start, $i - $start + 1);
                    $data = json_decode($json, true);

                    if (json_last_error() !== JSON_ERROR_NONE || ! is_array($data)) {
                        return null;
                    }

                    return [
                        'data' => $data,
                        'end' => $i + 1,
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Validate the required biometric punch fields.
     */
    public function validatePunch(array $data): bool
    {
        foreach (['user_id', 'verify_mode', 'io_mode', 'io_time'] as $field) {
            if (! isset($data[$field])) {
                return false;
            }
        }

        return is_numeric($data['verify_mode'])
            && is_numeric($data['io_mode'])
            && trim((string) $data['user_id']) !== ''
            && trim((string) $data['io_time']) !== '';
    }
}
