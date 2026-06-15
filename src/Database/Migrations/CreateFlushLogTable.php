<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Database\Migrations;

use Ploi\FastCgiCache\Log\FlushLogRepository;
use WPForge\Database\Migration;

/**
 * Creates the flush-log table via the Foundation's dbDelta wrapper.
 */
final class CreateFlushLogTable extends Migration
{
    public function version(): string
    {
        return '2024_06_01_create_flush_log';
    }

    public function up(): void
    {
        $table   = $this->tableName(FlushLogRepository::TABLE);
        $collate = $this->charsetCollate();

        // dbDelta is whitespace-sensitive: two spaces after PRIMARY KEY, one
        // field per line, lowercase types.
        $sql = "CREATE TABLE {$table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            created_at datetime NOT NULL,
            reason varchar(40) NOT NULL DEFAULT '',
            server_id varchar(64) NOT NULL DEFAULT '',
            site_id varchar(64) NOT NULL DEFAULT '',
            success tinyint(1) NOT NULL DEFAULT 0,
            http_code smallint(5) unsigned NOT NULL DEFAULT 0,
            duration_ms int(10) unsigned NOT NULL DEFAULT 0,
            message text NULL,
            PRIMARY KEY  (id),
            KEY created_at (created_at)
        ) {$collate};";

        $this->dbDelta($sql);
    }

    public function down(): void
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        $table = $this->tableName(FlushLogRepository::TABLE);
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query("DROP TABLE IF EXISTS {$table}");
    }
}
