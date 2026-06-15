<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Lifecycle;

use Ploi\FastCgiCache\Cache\FlushScheduler;
use Ploi\FastCgiCache\Log\FlushLogRepository;

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
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query("DROP TABLE IF EXISTS {$table}");

        delete_option($optionPrefix . '_settings');
        delete_option($optionPrefix . '_migrations');

        wp_clear_scheduled_hook(FlushScheduler::CRON_HOOK);
        delete_transient('ploi_fastcgi_cache_pending');
    }
}
