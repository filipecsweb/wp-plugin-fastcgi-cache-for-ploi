<?php

declare(strict_types=1);

namespace WPForge\Database;

use wpdb;

/**
 * A single, idempotent schema migration applied through dbDelta().
 *
 * version() must be a stable, unique identifier; the Migrator records it so the
 * migration runs exactly once.
 */
abstract class Migration
{
    abstract public function version(): string;

    abstract public function up(): void;

    public function down(): void
    {
    }

    protected function dbDelta(string $sql): void
    {
        if (! function_exists('dbDelta')) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        dbDelta($sql);
    }

    protected function charsetCollate(): string
    {
        return $this->wpdb()->get_charset_collate();
    }

    protected function tableName(string $name): string
    {
        return $this->wpdb()->prefix . $name;
    }

    protected function wpdb(): wpdb
    {
        /** @var wpdb $wpdb */
        global $wpdb;

        return $wpdb;
    }
}
