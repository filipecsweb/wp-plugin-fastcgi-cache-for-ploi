<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Tests\Unit\Ploi;

use Brain\Monkey\Functions;
use Ploi\FastCgiCache\Ploi\PloiApiException;
use WPForge\Http\Response;

beforeEach(function (): void {
    Functions\when('__')->returnArg(1);
});

it('prefers the Ploi API "message" field when present', function (): void {
    $response = new Response(422, (string) json_encode(['message' => 'The given data was invalid.']));

    expect(PloiApiException::messageFromResponse($response))->toBe('The given data was invalid.');
});

it('falls back to the transport error when there is no API message', function (): void {
    $response = new Response(0, '', [], 'Connection timed out');

    expect(PloiApiException::messageFromResponse($response))->toBe('Connection timed out');
});

it('falls back to a translated HTTP-status line when neither message nor error is present', function (): void {
    // The narrow fallback CacheFlusher previously stored as a bare "HTTP %d"; it
    // now shares PloiApiException's translated, more legible string. This is the
    // one behaviour change in the dedup, so it is pinned here explicitly.
    $response = new Response(502, '');

    expect(PloiApiException::messageFromResponse($response))->toBe('The Ploi API request failed (HTTP 502).');
});

it('returns a token-rejected message for 401/403 without reading the body', function (): void {
    $exception = PloiApiException::fromResponse(new Response(401, ''));

    expect($exception->getMessage())->toBe('Your Ploi API token was rejected. Check the token and try again.')
        ->and($exception->statusCode())->toBe(401);
});
