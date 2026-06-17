<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Lifecycle;

use FastCgiCacheForPloi\Cache\FlushScheduler;

/**
 * Deactivation handler: clear any pending coalesced flush.
 */
final class Deactivator
{
    public static function deactivate(): void
    {
        wp_clear_scheduled_hook(FlushScheduler::CRON_HOOK);
        delete_transient(FlushScheduler::LOCK);
    }
}
