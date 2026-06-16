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
            return $this->error('flush_failed', $this->failureNotice($entry->httpCode, $entry->message), 502);
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
     * The log keeps the raw Ploi message (see CacheFlusher) for debugging; this
     * only shapes what the admin sees. Ploi answers 422 on the flush endpoint
     * when the site has no FastCGI cache to flush, and its raw "The given data
     * was invalid." is opaque. We can't prove 422 is exclusive to that case, so
     * we hedge ("may not be enabled") and still append Ploi's raw message so any
     * other 422 cause stays legible. Bad server/site IDs return 404, not 422.
     */
    private function failureNotice(int $httpCode, ?string $raw): string
    {
        $raw = $raw !== null && $raw !== '' ? $raw : null;

        if ($httpCode === 422) {
            $hint = __('Ploi rejected the flush — FastCGI caching may not be enabled for this site.', 'ploi-fastcgi-cache');

            return $raw === null ? $hint : sprintf(
                /* translators: 1: friendly explanation, 2: raw message from the Ploi API. */
                __('%1$s (Ploi: %2$s)', 'ploi-fastcgi-cache'),
                $hint,
                $raw
            );
        }

        return $raw ?? __('The flush request failed.', 'ploi-fastcgi-cache');
    }
}
