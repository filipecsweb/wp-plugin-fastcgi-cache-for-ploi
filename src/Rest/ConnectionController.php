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
 * POST   /connection/test     validate a token (provided or saved); on success
 *                             with a NEW token, encrypt + save it. (Concern 2:
 *                             token persistence happens here.)
 * DELETE /connection          disconnect: delete the saved token + target and
 *                             reset the reconnect flag. (Inverse of token save;
 *                             event toggles + debounce are preserved.)
 * GET    /servers             list the connected account's servers
 * GET    /servers/{server}/sites list a server's sites
 */
final class ConnectionController extends PloiRestController
{
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
            'methods'             => 'DELETE',
            'callback'            => [$this, 'disconnect'],
            'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
        ]);

        $this->registerRoute('/servers', [
            'methods'             => 'GET',
            'callback'            => [$this, 'servers'],
            'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
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
     * dropdowns (Save does both). Verifies BOTH scopes the plugin needs: read
     * Servers, then read Sites (probing one server). Returns a single message the
     * client surfaces as a dismissible notice; the token is stored only on Save.
     */
    public function test(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $provided = trim($this->stringParam($request, 'token'));
        $token    = $provided !== '' ? $provided : $this->settings->token();

        if ($token === null || $token === '') {
            return $this->error('no_token', __('Enter a Ploi API token to test.', 'fastcgi-cache-for-ploi'), 400);
        }

        try {
            $servers = $this->client->servers($token);

            // Verify the Sites scope by probing one server. Re-check the saved
            // server when testing the saved token; for a freshly entered token
            // probe its OWN first server (the saved one may be another account).
            $probeServer = ($provided === '' && $this->settings->serverId() !== '')
                ? $this->settings->serverId()
                : (string) ($servers[0]['id'] ?? '');

            if ($probeServer === '') {
                // Valid token, but the account has no servers: nothing to probe
                // the Sites scope against, and nothing to flush yet.
                return $this->respond([
                    'success' => true,
                    'message' => __('Your token works, but this Ploi account has no servers yet — there\'s nothing to flush.', 'fastcgi-cache-for-ploi'),
                ]);
            }

            $this->client->sites($token, $probeServer);
        } catch (PloiApiException $exception) {
            return $this->ploiError($exception);
        }

        return $this->respond([
            'success' => true,
            'message' => $provided !== ''
                ? __('Your token works and has the required permissions. Save your settings to apply it.', 'fastcgi-cache-for-ploi')
                : __('Your saved token is still valid.', 'fastcgi-cache-for-ploi'),
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

    public function servers(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        return $this->withToken(fn (string $token): WP_REST_Response => $this->respond(
            ['servers' => $this->client->servers($token)]
        ));
    }

    public function sites(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $server = $this->stringParam($request, 'server');

        return $this->withToken(fn (string $token): WP_REST_Response => $this->respond(
            ['sites' => $this->client->sites($token, $server)]
        ));
    }

    /**
     * Resolve the saved token (or bail to the reconnect error) and run $fn with
     * it inside the shared Ploi-error handler. The single home for the
     * null-token -> reconnect gate and the PloiApiException -> error mapping that
     * servers() and sites() share.
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

    private function statusFor(PloiApiException $exception): int
    {
        $status = $exception->statusCode();

        return $status >= 400 && $status < 600 ? $status : self::STATUS_UPSTREAM_FAILURE;
    }
}
