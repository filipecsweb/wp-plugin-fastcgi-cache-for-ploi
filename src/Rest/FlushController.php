<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Rest;

use FastCgiCacheForPloi\Cache\CacheFlusher;
use FastCgiCacheForPloi\Cache\FlushReason;
use FastCgiCacheForPloi\Log\FlushLogEntry;
use FastCgiCacheForPloi\Providers\RestServiceProvider;
use FastCgiCacheForPloi\Settings\PloiSettings;
use FastCgiCacheForPloi\Foundation\Security\Capability;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Flushes synchronously, bypassing the debounce that the event-driven path uses.
 */
final class FlushController extends PloiRestController
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
            'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
        ]);
    }

    public function flush(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        if (! $this->settings->isConfigured()) {
            if ($this->settings->needsReconnect()) {
                return $this->reconnectError();
            }

            return $this->error(
                'not_configured',
                __('Add a token, then choose a server and site before flushing.', 'fastcgi-cache-for-ploi'),
                400
            );
        }

        $entry = $this->flusher->flush(FlushReason::Manual);

        if ($entry === null) {
            return $this->error('not_configured', __('Nothing to flush — the plugin is not configured.', 'fastcgi-cache-for-ploi'), 400);
        }

        if (! $entry->success) {
            $notice = $this->failureNotice($entry->httpCode, $entry->message);

            // Ploi rejected the saved token (401) or it lost a scope (403): surface
            // the real status so the client raises the reconnect banner instead of
            // a transient toast it would never tie to "your token went bad".
            if ($this->isReconnectStatus($entry->httpCode)) {
                return $this->error('ploi_error', $notice, $entry->httpCode);
            }

            return $this->error('flush_failed', $notice, self::STATUS_UPSTREAM_FAILURE);
        }

        return $this->respond([
            'success' => true,
            'message' => __('FastCGI cache flushed.', 'fastcgi-cache-for-ploi'),
            'entry'   => $entry->toArray(),
        ]);
    }

    /**
     * Build the user-facing notice for a failed flush.
     *
     * The per-status gloss is single-sourced in {@see FlushLogEntry::failureHint()}
     * so this notice and the log row stay in lockstep; here we only COMPOSE that
     * hint with Ploi's raw message (kept for debugging), or fall back to the raw
     * message when we have no specific gloss for the status.
     */
    private function failureNotice(int $httpCode, ?string $raw): string
    {
        $raw  = $raw !== null && $raw !== '' ? $raw : null;
        $hint = FlushLogEntry::failureHint($httpCode);

        if ($hint === null) {
            return $raw ?? __('The flush request failed.', 'fastcgi-cache-for-ploi');
        }

        return $raw === null ? $hint : sprintf(
            /* translators: 1: friendly explanation, 2: raw message from the Ploi API. */
            __('%1$s (Ploi: %2$s)', 'fastcgi-cache-for-ploi'),
            $hint,
            $raw
        );
    }
}
