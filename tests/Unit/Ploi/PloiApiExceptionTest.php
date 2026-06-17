<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Tests\Unit\Ploi;

use Brain\Monkey\Functions;
use FastCgiCacheForPloi\Ploi\PloiApiException;
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
    // Pins the one behaviour change in the dedup: fallback went from bare "HTTP %d" to the translated string.
    $response = new Response(502, '');

    expect(PloiApiException::messageFromResponse($response))->toBe('The Ploi API request failed (HTTP 502).');
});

it('returns a token-rejected message for an invalid token (401), without reading the body', function (): void {
    $exception = PloiApiException::fromResponse(new Response(401, ''));

    expect($exception->getMessage())->toBe('Your Ploi API token was rejected. Check the token and try again.')
        ->and($exception->statusCode())->toBe(401);
});

it('returns a missing-permission message for an under-scoped token (403), without reading the body', function (): void {
    $exception = PloiApiException::fromResponse(new Response(403, ''));

    expect($exception->getMessage())->toBe('This Ploi API token is missing a required permission. Use a token with the Servers and Sites scopes.')
        ->and($exception->statusCode())->toBe(403);
});
