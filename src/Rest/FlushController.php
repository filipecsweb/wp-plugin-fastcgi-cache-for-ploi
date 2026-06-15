<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Rest;

use Ploi\FastCgiCache\Cache\CacheFlusher;
use Ploi\FastCgiCache\Cache\FlushReason;
use Ploi\FastCgiCache\Settings\PloiSettings;
use WPForge\Rest\RestController;
use WPForge\Security\Capability;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manual "Flush now". Flushes the SAVED target synchronously (no debounce) and
 * returns the resulting log entry. Refuses cleanly when not configured / when a
 * reconnect is required (concern 3 + 4).
 */
final class FlushController extends RestController
{
    public function __construct(
        string $namespace,
        Capability $capability,
        private readonly PloiSettings $settings,
        private readonly CacheFlusher $flusher,
    ) {
        parent::__construct($namespace, $capability);
    }

    public function registerRoutes(): void
    {
        $this->registerRoute('/flush', [
            'methods'             => 'POST',
            'callback'            => [$this, 'flush'],
            'permission_callback' => $this->guard('manage_options'),
        ]);
    }

    public function flush(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        if (! $this->settings->isConfigured()) {
            if ($this->settings->needsReconnect()) {
                return $this->error(
                    'needs_reconnect',
                    __('Your saved token could not be read. Please re-enter your Ploi API token.', 'ploi-fastcgi-cache'),
                    409
                );
            }

            return $this->error(
                'not_configured',
                __('Add a token, then choose a server and site before flushing.', 'ploi-fastcgi-cache'),
                400
            );
        }

        $entry = $this->flusher->flush(FlushReason::Manual);

        if ($entry === null) {
            return $this->error('not_configured', __('Nothing to flush — the plugin is not configured.', 'ploi-fastcgi-cache'), 400);
        }

        if (! $entry->success) {
            return $this->error(
                'flush_failed',
                $entry->message ?? __('The flush request failed.', 'ploi-fastcgi-cache'),
                502
            );
        }

        return $this->respond([
            'success' => true,
            'message' => __('FastCGI cache flushed.', 'ploi-fastcgi-cache'),
            'entry'   => $entry->toArray(),
        ]);
    }
}
