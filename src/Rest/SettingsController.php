<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Rest;

use FastCgiCacheForPloi\Ploi\PloiApiException;
use FastCgiCacheForPloi\Ploi\PloiClient;
use FastCgiCacheForPloi\Providers\RestServiceProvider;
use FastCgiCacheForPloi\Settings\PloiSettings;
use WPForge\Security\Capability;
use WPForge\Security\Sanitizer;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Saving a new token re-validates the saved target against it and clears it on
 * mismatch, so Flush can't fire at a stale cross-account site.
 */
final class SettingsController extends PloiRestController
{
    public function __construct(
        string $namespace,
        Capability $capability,
        private readonly PloiSettings $settings,
        private readonly Sanitizer $sanitizer,
        private readonly PloiClient $client,
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

        $this->registerRoute('/target', [
            'methods'             => 'POST',
            'callback'            => [$this, 'saveTarget'],
            'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
        ]);
    }

    public function show(WP_REST_Request $request): WP_REST_Response
    {
        return $this->respond($this->settings->toArray());
    }

    /**
     * Persist ONLY the flush target (server + site), leaving the token, events,
     * and debounce untouched. The change-target modal selects from Ploi's own live
     * list, so the IDs are valid by construction — no re-probe needed here.
     */
    public function saveTarget(WP_REST_Request $request): WP_REST_Response
    {
        $this->applyTarget($request);

        return $this->respond($this->settings->toArray());
    }

    public function save(WP_REST_Request $request): WP_REST_Response
    {
        $token    = trim($this->stringParam($request, 'token'));
        $newToken = $token !== '';

        if ($newToken) {
            $this->settings->setToken($token);
        }

        $this->applyTarget($request);

        $events = $request->get_param('events');
        $this->settings->setEvents(is_array($events) ? $events : []);

        $debounce = $request->get_param('debounce');
        $this->settings->setDebounce(is_numeric($debounce) ? (int) $debounce : PloiSettings::DEBOUNCE_DEFAULT);

        // A freshly saved token must be able to reach the saved target. If it
        // can't (scope downgrade, or a token from a different Ploi account whose
        // server/site IDs simply don't exist there), clear the target so Flush
        // disables instead of pointing at a stale, cross-account site.
        $targetCleared = $newToken && ! $this->targetValidWith($token);

        if ($targetCleared) {
            $this->settings->clearTarget();
        }

        $data = $this->settings->toArray();

        if ($targetCleared) {
            $data['targetCleared'] = true;
            $data['message']       = __(
                'Saved, but the selected server and site aren\'t available with this token. Re-select your server and site.',
                'fastcgi-cache-for-ploi'
            );
        }

        return $this->respond($data);
    }

    private function applyTarget(WP_REST_Request $request): void
    {
        $this->settings->setTarget(
            $this->sanitizer->text($this->stringParam($request, 'server_id')),
            $this->sanitizer->text($this->stringParam($request, 'site_id')),
            $this->sanitizer->text($this->stringParam($request, 'server_name')),
            $this->sanitizer->text($this->stringParam($request, 'site_domain')),
        );
    }

    /**
     * True when the saved target is still usable with the given token. A 403
     * (missing Sites scope) or 404 (the server/site doesn't exist for this
     * token's account) means "no longer usable". A 401 (rejected token) or any
     * transient/network failure is treated as "keep" — a token blip must not
     * destroy a valid target, and a rejected token is surfaced separately.
     */
    private function targetValidWith(string $token): bool
    {
        $serverId = $this->settings->serverId();
        $siteId   = $this->settings->siteId();

        if ($serverId === '' || $siteId === '') {
            return true;
        }

        try {
            $sites = $this->client->sites($token, $serverId);
        } catch (PloiApiException $exception) {
            return ! in_array($exception->statusCode(), [403, 404], true);
        }

        foreach ($sites as $site) {
            if (($site['id'] ?? null) === $siteId) {
                return true;
            }
        }

        // Server readable, but the saved site is gone from it.
        return false;
    }
}
