<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Rest;

use FastCgiCacheForPloi\Providers\RestServiceProvider;
use FastCgiCacheForPloi\Settings\PloiSettings;
use WPForge\Security\Capability;
use WPForge\Security\Sanitizer;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Read + persist the plugin settings.
 *
 * POST /settings persists target + events + debounce, and (re)saves the token if
 * a new one is supplied. The debounce value is clamped server-side (concern 6);
 * the token is never echoed back (concern 2) — only hasToken is reported.
 */
final class SettingsController extends PloiRestController
{
    public function __construct(
        string $namespace,
        Capability $capability,
        private readonly PloiSettings $settings,
        private readonly Sanitizer $sanitizer,
    ) {
        parent::__construct($namespace, $capability);
    }

    public function registerRoutes(): void
    {
        $this->registerRoute('/settings', [
            [
                'methods'             => 'GET',
                'callback'            => [$this, 'show'],
                'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
            ],
            [
                'methods'             => 'POST',
                'callback'            => [$this, 'save'],
                'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
            ],
        ]);
    }

    public function show(WP_REST_Request $request): WP_REST_Response
    {
        return $this->respond($this->settings->toArray());
    }

    public function save(WP_REST_Request $request): WP_REST_Response
    {
        $token = trim($this->stringParam($request, 'token'));

        if ($token !== '') {
            $this->settings->setToken($token);
        }

        $this->settings->setTarget(
            $this->sanitizer->text($this->stringParam($request, 'server_id')),
            $this->sanitizer->text($this->stringParam($request, 'site_id')),
            $this->sanitizer->text($this->stringParam($request, 'server_name')),
            $this->sanitizer->text($this->stringParam($request, 'site_domain')),
        );

        $events = $request->get_param('events');
        $this->settings->setEvents(is_array($events) ? $events : []);

        $debounce = $request->get_param('debounce');
        $this->settings->setDebounce(is_numeric($debounce) ? (int) $debounce : PloiSettings::DEBOUNCE_DEFAULT);

        return $this->respond($this->settings->toArray());
    }
}
