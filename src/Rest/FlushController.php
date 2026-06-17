<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Rest;

use Ploi\FastCgiCache\Cache\CacheFlusher;
use Ploi\FastCgiCache\Cache\FlushReason;
use Ploi\FastCgiCache\Log\FlushLogEntry;
use Ploi\FastCgiCache\Providers\RestServiceProvider;
use Ploi\FastCgiCache\Settings\PloiSettings;
use WPForge\Security\Capability;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manual "Flush now". Flushes the SAVED target synchronously (no debounce) and
 * returns the resulting log entry. Refuses cleanly when not configured / when a
 * reconnect is required (concern 3 + 4).
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
                __('Add a token, then choose a server and site before flushing.', 'ploi-fastcgi-cache'),
                400
            );
        }

        $entry = $this->flusher->flush(FlushReason::Manual);

        if ($entry === null) {
            return $this->error('not_configured', __('Nothing to flush — the plugin is not configured.', 'ploi-fastcgi-cache'), 400);
        }

        if (! $entry->success) {
            return $this->error('flush_failed', $this->failureNotice($entry->httpCode, $entry->message), self::STATUS_UPSTREAM_FAILURE);
        }

        return $this->respond([
            'success' => true,
            'message' => __('FastCGI cache flushed.', 'ploi-fastcgi-cache'),
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
            return $raw ?? __('The flush request failed.', 'ploi-fastcgi-cache');
        }

        return $raw === null ? $hint : sprintf(
            /* translators: 1: friendly explanation, 2: raw message from the Ploi API. */
            __('%1$s (Ploi: %2$s)', 'ploi-fastcgi-cache'),
            $hint,
            $raw
        );
    }
}
