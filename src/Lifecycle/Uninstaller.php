<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Lifecycle;

use FastCgiCacheForPloi\Cache\FlushScheduler;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Settings\OptionNames;

/**
 * @since 1.0.0
 */
final class Uninstaller
{
    public static function uninstall(string $optionPrefix): void
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        $drop = $wpdb->prepare('DROP TABLE IF EXISTS %i', FlushLogRepository::tableName());

        if (is_string($drop)) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- $drop is a prepared (%i) DROP of our own custom table on uninstall; caching does not apply to DDL.
            $wpdb->query($drop);
        }

        delete_option(OptionNames::settings($optionPrefix));
        delete_option(OptionNames::migrations($optionPrefix));

        wp_clear_scheduled_hook(FlushScheduler::CRON_HOOK);
        delete_transient(FlushScheduler::LOCK);
    }
}
