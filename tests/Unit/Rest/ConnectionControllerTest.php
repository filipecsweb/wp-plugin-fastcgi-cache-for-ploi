<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Tests\Unit\Rest;

use Brain\Monkey\Functions;
use FastCgiCacheForPloi\Ploi\PloiClient;
use FastCgiCacheForPloi\Rest\ConnectionController;
use FastCgiCacheForPloi\Foundation\Http\HttpClient;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;

/**
 * probeToken() is the single definition of "is this saved token healthy" behind
 * GET /connection. These cover the saved-server-deleted case (FIL: a healthy token
 * whose saved server was removed in Ploi must still hydrate the server list so the
 * client can reconcile), plus the auth/transient failures it must NOT mistake for it.
 *
 * A real PloiClient runs over a stubbed WordPress HTTP layer, so the servers/sites
 * calls and the PloiApiException mapping are exercised for real — only the wire is
 * faked, keyed by URL (…/sites vs …/servers).
 */
beforeEach(function (): void {
    Functions\when('__')->returnArg(1);
    Functions\when('wp_json_encode')->alias(static fn ($value): string => (string) json_encode($value));
    Functions\when('wp_remote_request')->alias(static fn (string $url, array $args = []): array => ['url' => $url]);
    Functions\when('wp_remote_retrieve_headers')->justReturn([]);
});

/**
 * Fake the two Ploi endpoints the probe hits. Each arg is ['status' => int,
 * 'body' => array]; requests are routed by URL (the sites endpoint contains /sites).
 *
 * @param array{status: int, body: array<mixed>} $servers
 * @param array{status: int, body: array<mixed>} $sites
 */
function conn_stub_ploi(array $servers, array $sites): void
{
    Functions\when('wp_remote_retrieve_response_code')->alias(
        static fn (array $resp): int => str_contains($resp['url'], '/sites') ? $sites['status'] : $servers['status']
    );
    Functions\when('wp_remote_retrieve_body')->alias(
        static fn (array $resp): string => (string) json_encode(
            str_contains($resp['url'], '/sites') ? $sites['body'] : $servers['body']
        )
    );
}

/**
 * @param string $token
 *
 * @return array<string, mixed>
 */
function conn_probe(string $token, string $preferServerId = ''): array
{
    $controller = (new ReflectionClass(ConnectionController::class))->newInstanceWithoutConstructor();

    $client = new ReflectionProperty(ConnectionController::class, 'client');
    $client->setAccessible(true);
    $client->setValue($controller, new PloiClient(new HttpClient()));

    $probe = new ReflectionMethod(ConnectionController::class, 'probeToken');
    $probe->setAccessible(true);

    return $probe->invoke($controller, $token, $preferServerId);
}

const CONN_SERVERS_OK = ['data' => [['id' => 115902, 'name' => 'srv-a'], ['id' => 220033, 'name' => 'srv-b']]];
const CONN_SITES_OK   = ['data' => [['id' => 377516, 'domain' => 'a.example']]];

it('keeps the token healthy and preserves the server list when the saved server is gone (404 on the sites probe)', function (): void {
    conn_stub_ploi(
        ['status' => 200, 'body' => CONN_SERVERS_OK],
        ['status' => 404, 'body' => ['message' => 'Unable to find this record.']]
    );

    $result = conn_probe('tkn', '999999999');

    // The client needs state=ok + the real servers to run deleted-server reconciliation;
    // the gone server's sites are empty and probedServerId is cleared (so status() hands
    // back no sites), and there is no exception to surface.
    expect($result['state'])->toBe('ok');
    expect($result['servers'])->toHaveCount(2);
    expect($result['sites'])->toBe([]);
    expect($result['probedServerId'])->toBe('');
    expect($result['exception'])->toBeNull();
});

it('probes both scopes and hydrates servers + the saved server sites on the happy path', function (): void {
    conn_stub_ploi(
        ['status' => 200, 'body' => CONN_SERVERS_OK],
        ['status' => 200, 'body' => CONN_SITES_OK]
    );

    $result = conn_probe('tkn', '115902');

    expect($result['state'])->toBe('ok');
    expect($result['servers'])->toHaveCount(2);
    expect($result['sites'])->toHaveCount(1);
    expect($result['probedServerId'])->toBe('115902');
    expect($result['exception'])->toBeNull();
});

it('treats a 403 on the sites probe as a missing Sites scope, not a gone server', function (): void {
    conn_stub_ploi(
        ['status' => 200, 'body' => CONN_SERVERS_OK],
        ['status' => 403, 'body' => ['message' => 'Forbidden']]
    );

    $result = conn_probe('tkn', '115902');

    expect($result['state'])->toBe('missing_permission');
    expect($result['servers'])->toBe([]);
    expect($result['exception'])->not->toBeNull();
});

it('maps a rejected token (401 on the servers call) to invalid', function (): void {
    conn_stub_ploi(
        ['status' => 401, 'body' => ['message' => 'Unauthenticated.']],
        ['status' => 200, 'body' => CONN_SITES_OK]
    );

    $result = conn_probe('tkn');

    expect($result['state'])->toBe('invalid');
    expect($result['servers'])->toBe([]);
    expect($result['exception'])->not->toBeNull();
});

it('does NOT treat a transient sites failure (500) as a gone server', function (): void {
    conn_stub_ploi(
        ['status' => 200, 'body' => CONN_SERVERS_OK],
        ['status' => 500, 'body' => ['message' => 'Server error']]
    );

    $result = conn_probe('tkn', '115902');

    expect($result['state'])->toBe('unknown');
    expect($result['servers'])->toBe([]);
    expect($result['exception'])->not->toBeNull();
});

it('reports a Servers-scoped token with an empty account as healthy with no server to probe', function (): void {
    conn_stub_ploi(
        ['status' => 200, 'body' => ['data' => []]],
        ['status' => 200, 'body' => CONN_SITES_OK]
    );

    $result = conn_probe('tkn');

    expect($result['state'])->toBe('ok');
    expect($result['servers'])->toBe([]);
    expect($result['probedServerId'])->toBe('');
    expect($result['exception'])->toBeNull();
});
