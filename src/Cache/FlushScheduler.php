<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Cache;

use FastCgiCacheForPloi\Settings\PloiSettings;

/**
 * Coalesces bursts of content changes into a SINGLE flush.
 *
 * A debounce lock (transient) plus a single one-off WP-Cron event: the first
 * trigger schedules one cron event `debounce` seconds out and records the
 * reason; every further trigger inside the window sees the event already
 * scheduled and does nothing. When the event fires, exactly one flush runs.
 *
 * debounce = 0 means "no added delay" — the event is scheduled for now and
 * fires on the next cron tick (still one flush per burst within a request).
 */
final class FlushScheduler
{
    public const CRON_HOOK = 'fastcgi_cache_for_ploi_flush';

    /**
     * Transient key for the pending-flush marker. Public so the lifecycle
     * teardown (Deactivator/Uninstaller) clears the exact same key, never a
     * re-typed copy.
     */
    public const LOCK = 'fastcgi_cache_for_ploi_pending';

    public function __construct(
        private readonly PloiSettings $settings,
        private readonly CacheFlusher $flusher,
    ) {
    }

    public function schedule(FlushReason $reason): void
    {
        if (get_transient(self::LOCK) === false) {
            set_transient(self::LOCK, $reason->value, 5 * MINUTE_IN_SECONDS);
        }

        if (! wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_single_event(time() + $this->settings->debounce(), self::CRON_HOOK);
        }
    }

    public function runScheduled(): void
    {
        $stored = get_transient(self::LOCK);
        delete_transient(self::LOCK);

        $reason = is_string($stored)
            ? (FlushReason::tryFrom($stored) ?? FlushReason::PostSave)
            : FlushReason::PostSave;

        $this->flusher->flush($reason);
    }
}
