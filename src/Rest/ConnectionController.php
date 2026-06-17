<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Rest;

use FastCgiCacheForPloi\Ploi\PloiApiException;
use FastCgiCacheForPloi\Ploi\PloiClient;
use FastCgiCacheForPloi\Providers\RestServiceProvider;
use FastCgiCacheForPloi\Settings\PloiSettings;
use WPForge\Security\Capability;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * test() validates without persisting; persistence and dropdown hydration happen
 * on Save (Concern 2).
 */
final class ConnectionController extends PloiRestController
{
    /**
     * Saved-connection health states. These string values are a contract with the
     * admin JS: store routeTokenFailure() maps invalid/missing_permission to the
     * persistent reconnect banner and anything else to a transient toast, so they
     * must stay in lockstep.
     */
    private const STATE_OK                 = 'ok';
    private const STATE_INVALID            = 'invalid';
    private const STATE_MISSING_PERMISSION = 'missing_permission';
    private const STATE_UNKNOWN            = 'unknown';
    private const STATE_ABSENT             = 'absent';

    public function __construct(
        string $namespace,
        Capability $capability,
        private readonly PloiSettings $settings,
        private readonly PloiClient $client,
    ) {
        parent::__construct($namespace, $capability);
    }

    public function registerRoutes(): void
    {
        $this->registerRoute('/connection/test', [
            'methods'             => 'POST',
            'callback'            => [$this, 'test'],
            'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
            'args'                => [
                'token' => ['type' => 'string', 'required' => false],
            ],
        ]);

        $this->registerRoute('/connection', [
            [
                'methods'             => 'GET',
                'callback'            => [$this, 'status'],
                'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
            ],
            [
                'methods'             => 'POST',
                'callback'            => [$this, 'connect'],
                'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
                'args'                => [
                    'token' => ['type' => 'string', 'required' => true],
                ],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [$this, 'disconnect'],
                'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
            ],
        ]);

        $this->registerRoute('/servers/(?P<server>[A-Za-z0-9_-]+)/sites', [
            'methods'             => 'GET',
            'callback'            => [$this, 'sites'],
            'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
            'args'                => [
                'server' => ['type' => 'string', 'required' => true],
            ],
        ]);
    }

    /**
     * Validate a token — read-only. NEVER persists the token and never loads the
     * dropdowns (Save does both). Verifies BOTH scopes the plugin needs via the
     * shared probe. Returns a single message the client surfaces as a dismissible
     * notice; the token is stored only on Save.
     */
    public function test(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $provided = trim($this->stringParam($request, 'token'));
        $token    = $provided !== '' ? $provided : $this->settings->token();

        if ($token === null || $token === '') {
            return $this->error('no_token', __('Enter a Ploi API token to test.', 'fastcgi-cache-for-ploi'), 400);
        }

        // Re-check the saved server when testing the saved token; for a freshly
        // entered token probe its OWN first server (the saved one may be another
        // account) — probeToken() falls back to the first server when this is ''.
        $result = $this->probeToken($token, $provided === '' ? $this->settings->serverId() : '');

        if ($result['exception'] !== null) {
            return $this->ploiError($result['exception']);
        }

        if ($result['servers'] === []) {
            // Valid token, but the account has no servers: nothing to flush yet.
            return $this->respond([
                'success' => true,
                'message' => __('Your token works, but this Ploi account has no servers yet — there\'s nothing to flush.', 'fastcgi-cache-for-ploi'),
            ]);
        }

        return $this->respond([
            'success' => true,
            'message' => $provided !== ''
                ? __('Your token works and has the required permissions. Save your settings to apply it.', 'fastcgi-cache-for-ploi')
                : __('Your saved token is still valid.', 'fastcgi-cache-for-ploi'),
        ]);
    }

    /**
     * Connect: validate a token against BOTH required scopes and persist it ONLY
     * if it passes, so a saved token is always known-good at save time. A bad or
     * under-scoped token is rejected with its Ploi message and never stored.
     */
    public function connect(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $token = trim($this->stringParam($request, 'token'));

        if ($token === '') {
            return $this->error('no_token', __('Enter a Ploi API token to connect.', 'fastcgi-cache-for-ploi'), 400);
        }

        $result = $this->probeToken($token);

        if ($result['exception'] !== null) {
            return $this->ploiError($result['exception']);
        }

        $this->settings->setToken($token);

        return $this->respond($this->settings->toArray() + ['state' => self::STATE_OK]);
    }

    /**
     * Live status of the SAVED connection — the single source the settings badge
     * reacts to. Probes both scopes with the same probeToken() the Test route
     * uses, so "is this token healthy" is defined once. Testing never reaches
     * here, which is why testing can't change the badge.
     */
    public function status(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $token = $this->settings->token();

        if ($token === null) {
            // token() clears the stored value and raises the reconnect flag on a
            // decrypt failure; the JS reconnect banner owns that path. Otherwise
            // there is simply no saved token.
            return $this->settings->needsReconnect()
                ? $this->reconnectError()
                : $this->respond(['state' => self::STATE_ABSENT, 'servers' => [], 'sites' => []]);
        }

        $serverId = $this->settings->serverId();
        $result   = $this->probeToken($token, $serverId);

        return $this->respond([
            'state'   => $result['state'],
            'servers' => $result['servers'],
            // Hand back the probed server's sites only when it IS the saved
            // server, so the client hydrates the Site dropdown without re-fetching.
            'sites'   => ($serverId !== '' && $result['probedServerId'] === $serverId) ? $result['sites'] : [],
        ]);
    }

    /**
     * Returns the post-disconnect settings snapshot so the client re-syncs like a
     * save.
     */
    public function disconnect(WP_REST_Request $request): WP_REST_Response
    {
        $this->settings->disconnect();

        return $this->respond($this->settings->toArray());
    }

    public function sites(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $server = $this->stringParam($request, 'server');

        return $this->withToken(fn (string $token): WP_REST_Response => $this->respond(
            ['sites' => $this->client->sites($token, $server)]
        ));
    }

    /**
     * Probe a token against the two scopes the plugin needs: read Servers, then
     * read Sites (against $preferServerId, else the account's first server). The
     * single definition of "is this token healthy", shared by test() and
     * status().
     *
     * Never throws — a PloiApiException is mapped to a state and returned, so both
     * callers branch on a value instead of repeating the try/catch. The fetched
     * servers + probed server's sites ride along so status() can hydrate the
     * dropdowns without a second Ploi round-trip.
     *
     * @return array{
     *     state: string,
     *     servers: list<array<string, string>>,
     *     sites: list<array<string, string>>,
     *     probedServerId: string,
     *     exception: ?PloiApiException
     * }
     */
    private function probeToken(string $token, string $preferServerId = ''): array
    {
        try {
            $servers     = $this->client->servers($token);
            $probeServer = $preferServerId !== '' ? $preferServerId : (string) ($servers[0]['id'] ?? '');

            // No server to probe the Sites scope against (the account has none):
            // the token is valid and Servers-scoped — healthy, nothing to flush.
            if ($probeServer === '') {
                return [
                    'state'          => self::STATE_OK,
                    'servers'        => $servers,
                    'sites'          => [],
                    'probedServerId' => '',
                    'exception'      => null,
                ];
            }

            $sites = $this->client->sites($token, $probeServer);

            return [
                'state'          => self::STATE_OK,
                'servers'        => $servers,
                'sites'          => $sites,
                'probedServerId' => $probeServer,
                'exception'      => null,
            ];
        } catch (PloiApiException $exception) {
            return [
                'state'          => $this->stateFor($exception),
                'servers'        => [],
                'sites'          => [],
                'probedServerId' => '',
                'exception'      => $exception,
            ];
        }
    }

    /**
     * Shared null-token -> reconnect gate + PloiApiException mapping for the
     * saved-token routes.
     *
     * @param callable(string): WP_REST_Response $fn
     */
    private function withToken(callable $fn): WP_REST_Response|WP_Error
    {
        $token = $this->settings->token();

        if ($token === null) {
            return $this->reconnectError();
        }

        try {
            return $fn($token);
        } catch (PloiApiException $exception) {
            return $this->ploiError($exception);
        }
    }

    private function ploiError(PloiApiException $exception): WP_Error
    {
        return $this->error('ploi_error', $exception->getMessage(), $this->statusFor($exception));
    }

    /**
     * Non-auth failures (5xx, network) map to UNKNOWN, never INVALID — don't tell
     * users to re-enter a good token.
     */
    private function stateFor(PloiApiException $exception): string
    {
        return match ($exception->statusCode()) {
            401     => self::STATE_INVALID,
            403     => self::STATE_MISSING_PERMISSION,
            default => self::STATE_UNKNOWN,
        };
    }

    private function statusFor(PloiApiException $exception): int
    {
        $status = $exception->statusCode();

        return $status >= 400 && $status < 600 ? $status : self::STATUS_UPSTREAM_FAILURE;
    }
}
