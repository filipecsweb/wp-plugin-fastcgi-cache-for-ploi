<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Rest;

use Ploi\FastCgiCache\Ploi\PloiApiException;
use Ploi\FastCgiCache\Ploi\PloiClient;
use Ploi\FastCgiCache\Settings\PloiSettings;
use WPForge\Rest\RestController;
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
final class ConnectionController extends RestController
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
            'permission_callback' => $this->guard('manage_options'),
            'args'                => [
                'token' => ['type' => 'string', 'required' => false],
            ],
        ]);

        $this->registerRoute('/connection', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'disconnect'],
            'permission_callback' => $this->guard('manage_options'),
        ]);

        $this->registerRoute('/servers', [
            'methods'             => 'GET',
            'callback'            => [$this, 'servers'],
            'permission_callback' => $this->guard('manage_options'),
        ]);

        $this->registerRoute('/servers/(?P<server>[A-Za-z0-9_-]+)/sites', [
            'methods'             => 'GET',
            'callback'            => [$this, 'sites'],
            'permission_callback' => $this->guard('manage_options'),
            'args'                => [
                'server' => ['type' => 'string', 'required' => true],
            ],
        ]);
    }

    public function test(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $provided = trim($this->stringParam($request, 'token'));
        $token    = $provided !== '' ? $provided : $this->settings->token();

        if ($token === null || $token === '') {
            return $this->error('no_token', __('Enter a Ploi API token to test.', 'ploi-fastcgi-cache'), 400);
        }

        try {
            $servers = $this->client->servers($token);
        } catch (PloiApiException $exception) {
            return $this->error('ploi_error', $exception->getMessage(), $this->statusFor($exception));
        }

        // Persist only a freshly entered, verified token.
        if ($provided !== '') {
            $this->settings->setToken($provided);
        }

        return $this->respond([
            'success' => true,
            'message' => __('Connection successful — token saved.', 'ploi-fastcgi-cache'),
            'servers' => $servers,
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
        $token = $this->settings->token();

        if ($token === null) {
            return $this->reconnect();
        }

        try {
            return $this->respond(['servers' => $this->client->servers($token)]);
        } catch (PloiApiException $exception) {
            return $this->error('ploi_error', $exception->getMessage(), $this->statusFor($exception));
        }
    }

    public function sites(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $token = $this->settings->token();

        if ($token === null) {
            return $this->reconnect();
        }

        $server = $this->stringParam($request, 'server');

        try {
            return $this->respond(['sites' => $this->client->sites($token, $server)]);
        } catch (PloiApiException $exception) {
            return $this->error('ploi_error', $exception->getMessage(), $this->statusFor($exception));
        }
    }

    private function reconnect(): WP_Error
    {
        return $this->error(
            'needs_reconnect',
            __('Your saved token could not be read. Please re-enter your Ploi API token.', 'ploi-fastcgi-cache'),
            409
        );
    }

    private function statusFor(PloiApiException $exception): int
    {
        $status = $exception->statusCode();

        return $status >= 400 && $status < 600 ? $status : 502;
    }
}
