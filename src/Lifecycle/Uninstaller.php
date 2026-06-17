<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Lifecycle;

use FastCgiCacheForPloi\Cache\FlushScheduler;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Settings\OptionNames;

/**
 * Uninstall handler. Drops the custom table and removes all plugin data.
 */
final class Uninstaller
{
    public static function uninstall(string $optionPrefix): void
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        $table = $wpdb->prefix . FlushLogRepository::TABLE;
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Dropping our own custom table on uninstall; $table derives from $wpdb->prefix (trusted) and caching does not apply to DDL.
        $wpdb->query("DROP TABLE IF EXISTS {$table}");

        delete_option(OptionNames::settings($optionPrefix));
        delete_option(OptionNames::migrations($optionPrefix));

        wp_clear_scheduled_hook(FlushScheduler::CRON_HOOK);
        delete_transient(FlushScheduler::LOCK);
    }
}
