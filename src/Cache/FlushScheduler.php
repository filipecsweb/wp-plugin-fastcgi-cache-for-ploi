<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Cache;

/**
 * Coalesces bursts of content changes into a SINGLE flush.
 *
 * A pending-flush lock (transient) plus a single one-off WP-Cron event: the first
 * trigger schedules one cron event COALESCE_SECONDS out and records the reason;
 * every further trigger inside the window sees the event already scheduled and does
 * nothing. When the event fires, exactly one flush runs.
 *
 * @since 1.0.0
 */
final class FlushScheduler
{
    /**
     * @since 1.0.0
     */
    public const CRON_HOOK = 'fastcgi_cache_for_ploi_flush';

    /**
     * Transient key for the pending-flush marker. Public so the lifecycle
     * teardown (Deactivator/Uninstaller) clears the exact same key, never a
     * re-typed copy.
     *
     * @since 1.0.0
     */
    public const LOCK = 'fastcgi_cache_for_ploi_pending';

    /**
     * Fixed window (seconds) the first trigger schedules the single flush out by, so
     * a burst coalesces into one flush. A small constant, not a setting — coalescing
     * comes from the LOCK + wp_next_scheduled gate, not from this value.
     *
     * @since 1.0.0
     */
    public const COALESCE_SECONDS = 5;

    /**
     * @since 1.0.0
     */
    public function __construct(
        private readonly CacheFlusher $flusher,
    ) {
    }

    /**
     * @since 1.0.0
     */
    public function schedule(FlushReason $reason): void
    {
        if (get_transient(self::LOCK) === false) {
            set_transient(self::LOCK, $reason->value, 5 * MINUTE_IN_SECONDS);
        }

        if (! wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_single_event(time() + self::COALESCE_SECONDS, self::CRON_HOOK);
        }
    }

    /**
     * @since 1.0.0
     */
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
