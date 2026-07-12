<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Lifecycle;

use FastCgiCacheForPloi\Cache\FlushScheduler;

/**
 * @since 1.0.0
 */
final class Deactivator
{
    public static function deactivate(): void
    {
        wp_clear_scheduled_hook(FlushScheduler::CRON_HOOK);
        delete_transient(FlushScheduler::LOCK);
    }
}
