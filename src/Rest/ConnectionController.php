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
 * Connection + resource listing routes.
 *
 * POST   /connection/test     validate a token (provided or saved) — read-only.
 *                             (Concern 2: persistence happens on Save, not here.)
 * GET    /connection          live status of the SAVED connection: probe both
 *                             required scopes and report a state the settings
 *                             badge reacts to (on load + after Save). Returns the
 *                             servers (+ saved server's sites) so the dropdowns
 *                             hydrate without a second round-trip.
 * DELETE /connection          disconnect: delete the saved token + target and
 *                             reset the reconnect flag. (Inverse of token save;
 *                             event toggles + debounce are preserved.)
 * GET    /servers/{server}/sites list a server's sites
 */
final class ConnectionController extends PloiRestController
{
    /**
     * Saved-connection health states. These string values are a contract with the
     * admin JS (resources/js/settings/store.js maps them to a dot colour + the
     * i18n.connection copy), so they must stay in lockstep.
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
     * Disconnect: delete the saved token + target (idempotent). Returns the fresh
     * settings snapshot so the client re-syncs to the empty state, exactly like a
     * save. Goes through the same guard() (nonce + manage_options) as every route.
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
     * Resolve the saved token (or bail to the reconnect error) and run $fn with
     * it inside the shared Ploi-error handler. The single home for the
     * null-token -> reconnect gate and the PloiApiException -> error mapping.
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
     * Map a Ploi failure to the saved-connection health state: 401 is an invalid
     * token, 403 is a valid token missing a required scope, anything else (5xx,
     * network blip) is "couldn't verify" — never reported as invalid.
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
