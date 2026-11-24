<?php

namespace Tests\Unit;

use App\Services\DevicePayloadParser;
use PHPUnit\Framework\TestCase;

class DeviceWebhookParserTest extends TestCase
{
    private DevicePayloadParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new DevicePayloadParser();
    }

    public function test_it_extracts_valid_sdk_punch_payload(): void
    {
        $payload = json_encode([
            'fk_bin_data_lib' => 'M50',
            'user_id' => '00000003',
            'verify_mode' => 2,
            'io_mode' => 1,
            'io_time' => '20261108164249',
        ]);

        $result = $this->parser->extractLeadingJson($payload);

        $this->assertNotNull($result);
        $this->assertSame('00000003', $result['data']['user_id']);
        $this->assertSame(strlen($payload), $result['end']);
    }

    
public function test_it_extracts_json_after_binary_prefix(): void
{
    $json = json_encode([
        'user_id' => '00000003',
        'verify_mode' => 2,
        'io_mode' => 1,
        'io_time' => '20261108164249',
    ]);

    $lengthPrefix = pack('V', strlen($json));

    $result = $this->parser->extractLeadingJson(
        $lengthPrefix . $json
    );

    $this->assertNotNull($result);
    $this->assertSame('00000003', $result['data']['user_id']);
}

    public function test_it_extracts_json_with_trailing_binary_data(): void
{
    $json = json_encode([
        'user_id' => '00000003',
        'verify_mode' => 2,
        'io_mode' => 1,
        'io_time' => '20261108164249',
    ]);

    $imageLength = pack('V', 4);
    $imageData = "\xFF\xD8\xFF\xD9";

    $payload = pack('V', strlen($json))
        . $json
        . $imageLength
        . $imageData;

    $result = $this->parser->extractLeadingJson($payload);

    $this->assertNotNull($result);
    $this->assertSame('00000003', $result['data']['user_id']);
    $this->assertSame(strlen(pack('V', strlen($json)) . $json), $result['end']);
}




    public function test_it_validates_required_punch_fields(): void
    {
        $this->assertTrue($this->parser->validatePunch([
            'user_id' => '00000003',
            'verify_mode' => 2,
            'io_mode' => 1,
            'io_time' => '20261108164249',
        ]));
    }

    public function test_it_rejects_payload_with_missing_fields(): void
    {
        $this->assertFalse($this->parser->validatePunch([
            'user_id' => '00000003',
            'verify_mode' => 2,
        ]));
    }

    public function test_it_rejects_invalid_json(): void
    {
        $result = $this->parser->extractLeadingJson('{"user_id": "00000003"');

        $this->assertNull($result);
    }
}
