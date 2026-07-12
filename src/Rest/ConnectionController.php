<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Rest;

use FastCgiCacheForPloi\Ploi\PloiApiException;
use FastCgiCacheForPloi\Ploi\PloiClient;
use FastCgiCacheForPloi\Providers\RestServiceProvider;
use FastCgiCacheForPloi\Settings\PloiSettings;
use FastCgiCacheForPloi\Foundation\Security\Capability;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * @since 1.0.0
 */
final class ConnectionController extends PloiRestController
{
    /**
     * Saved-connection health states, a contract with the admin JS: invalid and
     * missing_permission route to the persistent reconnect banner (requireReconnect);
     * ok and unknown (any other non-auth failure, or no saved token) go to a transient
     * toast, so they must stay in lockstep.
     *
     * @since 1.0.0
     */
    private const STATE_OK                 = 'ok';
    /**
     * @since 1.0.0
     */
    private const STATE_INVALID            = 'invalid';
    /**
     * @since 1.0.0
     */
    private const STATE_MISSING_PERMISSION = 'missing_permission';
    /**
     * @since 1.0.0
     */
    private const STATE_UNKNOWN            = 'unknown';

    /**
     * @since 1.0.0
     */
    public function __construct(
        string $namespace,
        Capability $capability,
        private readonly PloiSettings $settings,
        private readonly PloiClient $client,
    ) {
        parent::__construct($namespace, $capability);
    }

    /**
     * @since 1.0.0
     */
    public function registerRoutes(): void
    {
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
     * Connect: validate a token against BOTH required scopes and persist it ONLY
     * if it passes, so a saved token is always known-good at save time. A bad or
     * under-scoped token is rejected with its Ploi message and never stored.
     *
     * @since 1.0.0
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
     * Live health of the SAVED connection: probes both scopes and returns the state
     * plus the servers (and the saved server's sites) so the client hydrates the
     * target dropdowns without a second round-trip.
     *
     * @since 1.0.0
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
                : $this->respond(['state' => self::STATE_UNKNOWN, 'servers' => [], 'sites' => []]);
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
     *
     * @since 1.0.0
     */
    public function disconnect(WP_REST_Request $request): WP_REST_Response
    {
        $this->settings->disconnect();

        return $this->respond($this->settings->toArray());
    }

    /**
     * @since 1.0.0
     */
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
     * single definition of "is this token healthy", used by connect() and
     * status().
     *
     * Never throws — a PloiApiException is mapped to a state and returned, so both
     * callers branch on a value instead of repeating the try/catch. The fetched
     * servers + probed server's sites ride along so status() can hydrate the
     * dropdowns without a second Ploi round-trip.
     *
     * @since 1.0.1 Reworked for the deleted-server fix: split the servers-fetch and
     *     sites-probe error paths, treat a 404 on the sites probe as a gone server
     *     (token stays healthy), and extract probeHealthy()/probeFailed().
     * @since 1.0.0
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
            $servers = $this->client->servers($token);
        } catch (PloiApiException $exception) {
            return $this->probeFailed($exception);
        }

        $probeServer = $preferServerId !== '' ? $preferServerId : (string) ($servers[0]['id'] ?? '');

        // No server to probe the Sites scope against (the account has none): the
        // token is valid and Servers-scoped — healthy, nothing to flush.
        if ($probeServer === '') {
            return $this->probeHealthy($servers, [], '');
        }

        try {
            $sites = $this->client->sites($token, $probeServer);
        } catch (PloiApiException $exception) {
            // A 404 means the probed server is GONE, not that the token is bad. Ploi
            // checks the token's scope BEFORE the resource, so a token missing the
            // Sites scope gets 403 (mapped below), never 404 — a 404 proves both
            // scopes are healthy. Keep the token OK and hand back the server list so
            // the client can reconcile the deleted saved server (its now-nonexistent
            // sites are simply empty); collapsing to "unknown, no servers" would
            // strand the client on a generic "can't reach Ploi" toast.
            if ($exception->statusCode() === 404) {
                return $this->probeHealthy($servers, [], '');
            }

            return $this->probeFailed($exception);
        }

        return $this->probeHealthy($servers, $sites, $probeServer);
    }

    /**
     * @since 1.0.1
     *
     * @param list<array<string, string>> $servers
     * @param list<array<string, string>> $sites
     *
     * @return array{
     *     state: string,
     *     servers: list<array<string, string>>,
     *     sites: list<array<string, string>>,
     *     probedServerId: string,
     *     exception: null
     * }
     */
    private function probeHealthy(array $servers, array $sites, string $probedServerId): array
    {
        return [
            'state'          => self::STATE_OK,
            'servers'        => $servers,
            'sites'          => $sites,
            'probedServerId' => $probedServerId,
            'exception'      => null,
        ];
    }

    /**
     * @since 1.0.1
     *
     * @return array{
     *     state: string,
     *     servers: list<array<string, string>>,
     *     sites: list<array<string, string>>,
     *     probedServerId: string,
     *     exception: PloiApiException
     * }
     */
    private function probeFailed(PloiApiException $exception): array
    {
        return [
            'state'          => $this->stateFor($exception),
            'servers'        => [],
            'sites'          => [],
            'probedServerId' => '',
            'exception'      => $exception,
        ];
    }

    /**
     * Shared null-token -> reconnect gate + PloiApiException mapping for the
     * saved-token routes.
     *
     * @since 1.0.0
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

    /**
     * @since 1.0.0
     */
    private function ploiError(PloiApiException $exception): WP_Error
    {
        return $this->error('ploi_error', $exception->getMessage(), $this->statusFor($exception));
    }

    /**
     * Non-auth failures (5xx, network) map to UNKNOWN, never INVALID — don't tell
     * users to re-enter a good token.
     *
     * @since 1.0.0
     */
    private function stateFor(PloiApiException $exception): string
    {
        return match ($exception->statusCode()) {
            401     => self::STATE_INVALID,
            403     => self::STATE_MISSING_PERMISSION,
            default => self::STATE_UNKNOWN,
        };
    }

    /**
     * @since 1.0.0
     */
    private function statusFor(PloiApiException $exception): int
    {
        $status = $exception->statusCode();

        return $status >= 400 && $status < 600 ? $status : self::STATUS_UPSTREAM_FAILURE;
    }
}
