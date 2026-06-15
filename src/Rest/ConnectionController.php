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
 * POST /connection/test       validate a token (provided or saved); on success
 *                             with a NEW token, encrypt + save it. (Concern 2:
 *                             token persistence happens here.)
 * GET  /servers               list the connected account's servers
 * GET  /servers/{server}/sites list a server's sites
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
