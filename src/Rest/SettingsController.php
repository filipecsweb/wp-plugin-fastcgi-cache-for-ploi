<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Rest;

use FastCgiCacheForPloi\Providers\RestServiceProvider;
use FastCgiCacheForPloi\Settings\PloiSettings;
use FastCgiCacheForPloi\Foundation\Security\Capability;
use FastCgiCacheForPloi\Foundation\Security\Sanitizer;
use WP_REST_Request;
use WP_REST_Response;

/**
 * /settings persists ONLY the event toggles. The Ploi token is owned by /connection
 * and the flush target by /target, so neither is writable here — each piece of state
 * has a single writer.
 *
 * @since 1.0.0
 */
final class SettingsController extends PloiRestController
{
    /**
     * @since 1.0.0
     */
    public function __construct(
        string $namespace,
        Capability $capability,
        private readonly PloiSettings $settings,
        private readonly Sanitizer $sanitizer,
    ) {
        parent::__construct($namespace, $capability);
    }

    /**
     * @since 1.0.0
     */
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

        $this->registerRoute('/target', [
            'methods'             => 'POST',
            'callback'            => [$this, 'saveTarget'],
            'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
        ]);
    }

    /**
     * @since 1.0.0
     */
    public function show(WP_REST_Request $request): WP_REST_Response
    {
        return $this->respond($this->settings->toArray());
    }

    /**
     * Persist ONLY the flush target (server + site). The change-target modal selects
     * from Ploi's own live list, so the IDs are valid by construction — no re-probe.
     *
     * @since 1.0.0
     */
    public function saveTarget(WP_REST_Request $request): WP_REST_Response
    {
        $this->settings->setTarget(
            $this->sanitizer->text($this->stringParam($request, 'server_id')),
            $this->sanitizer->text($this->stringParam($request, 'site_id')),
            $this->sanitizer->text($this->stringParam($request, 'server_name')),
            $this->sanitizer->text($this->stringParam($request, 'site_domain')),
        );

        return $this->respond($this->settings->toArray());
    }

    /**
     * @since 1.0.0
     */
    public function save(WP_REST_Request $request): WP_REST_Response
    {
        $events = $request->get_param('events');
        $this->settings->setEvents(is_array($events) ? $events : []);

        return $this->respond($this->settings->toArray());
    }
}
