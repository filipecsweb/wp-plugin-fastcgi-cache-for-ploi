<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Rest;

use Ploi\FastCgiCache\Settings\PloiSettings;
use WPForge\Rest\RestController;
use WPForge\Security\Capability;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Read + persist the plugin settings.
 *
 * POST /settings persists target + events + debounce, and (re)saves the token if
 * a new one is supplied. The debounce value is clamped server-side (concern 6);
 * the token is never echoed back (concern 2) — only hasToken is reported.
 */
final class SettingsController extends RestController
{
    public function __construct(
        string $namespace,
        Capability $capability,
        private readonly PloiSettings $settings,
    ) {
        parent::__construct($namespace, $capability);
    }

    public function registerRoutes(): void
    {
        $this->registerRoute('/settings', [
            [
                'methods'             => 'GET',
                'callback'            => [$this, 'show'],
                'permission_callback' => $this->guard('manage_options'),
            ],
            [
                'methods'             => 'POST',
                'callback'            => [$this, 'save'],
                'permission_callback' => $this->guard('manage_options'),
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
            sanitize_text_field($this->stringParam($request, 'server_id')),
            sanitize_text_field($this->stringParam($request, 'site_id')),
            sanitize_text_field($this->stringParam($request, 'server_name')),
            sanitize_text_field($this->stringParam($request, 'site_domain')),
        );

        $events = $request->get_param('events');
        $this->settings->setEvents(is_array($events) ? $events : []);

        $debounce = $request->get_param('debounce');
        $this->settings->setDebounce(is_numeric($debounce) ? (int) $debounce : PloiSettings::DEBOUNCE_DEFAULT);

        return $this->respond($this->settings->toArray());
    }
}
