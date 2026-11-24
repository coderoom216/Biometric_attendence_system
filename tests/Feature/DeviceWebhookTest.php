<?php

namespace Tests\Feature;

use Tests\TestCase;

class DeviceWebhookTest extends TestCase
{
    /**
     * Unsupported request codes should be acknowledged.
     */
    public function test_it_acknowledges_unsupported_request_codes(): void
    {
        $response = $this->call(
            'POST',
            '/api/device/webhook',
            [],
            [],
            [],
            [
                'HTTP_REQUEST_CODE' => 'unknown_request',
            ]
        );

        $response->assertStatus(200);
        $response->assertHeader('response_code', 'OK');
    }

    /**
     * Punch payload with missing required fields should be rejected.
     */
    public function test_it_rejects_punch_payload_with_missing_fields(): void
    {
        $payload = json_encode([
            'user_id' => '00000003',
            'verify_mode' => 2,
        ]);

        $response = $this->call(
            'POST',
            '/api/device/webhook',
            [],
            [],
            [],
            [
                'HTTP_REQUEST_CODE' => 'realtime_glog',
                'HTTP_DEV_ID' => 'RSS20241199684',
                'CONTENT_TYPE' => 'application/octet-stream',
            ],
            $payload
        );

        $response->assertStatus(422);
        $response->assertHeader('response_code', 'ERROR');
    }

    /**
     * Malformed JSON should return an error.
     */
    public function test_it_rejects_malformed_json_payload(): void
    {
        $payload = '{"user_id":"00000003","verify_mode":2';

        $response = $this->call(
            'POST',
            '/api/device/webhook',
            [],
            [],
            [],
            [
                'HTTP_REQUEST_CODE' => 'realtime_glog',
                'HTTP_DEV_ID' => 'RSS20241199684',
                'CONTENT_TYPE' => 'application/octet-stream',
            ],
            $payload
        );

        $response->assertStatus(400);
        $response->assertHeader('response_code', 'ERROR');
    }

    /**
     * Image continuation packets without JSON should be acknowledged.
     */
    public function test_it_acknowledges_image_continuation_packet(): void
    {
        $payload = pack('V', 4) . "\xFF\xD8\xFF\xD9";

        $response = $this->call(
            'POST',
            '/api/device/webhook',
            [],
            [],
            [],
            [
                'HTTP_REQUEST_CODE' => 'realtime_glog',
                'HTTP_DEV_ID' => 'RSS20241199684',
                'CONTENT_TYPE' => 'application/octet-stream',
            ],
            $payload
        );

        $response->assertStatus(200);
        $response->assertHeader('response_code', 'OK');
    }
}
