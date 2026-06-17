<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Log;

/**
 * Reads and writes flush-log rows in the custom table created by the migration.
 *
 * The table name is derived from $wpdb->prefix (trusted), never user input, so
 * interpolating it into queries is safe; values always use $wpdb->prepare().
 */
final class FlushLogRepository
{
    public const TABLE = 'fastcgi_cache_for_ploi_flush_log';

    /**
     * How many recent rows the "Recent flushes" table shows. Single source for
     * both the initial server-side hydration (AdminServiceProvider) and the
     * GET /log refresh (LogController), so the two can't show different counts.
     */
    public const RECENT_LIMIT = 20;

    private string $table;

    public function __construct()
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        $this->table = $wpdb->prefix . self::TABLE;
    }

    public function insert(FlushLogEntry $entry): int
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Inserting one row into our own custom log table.
        $wpdb->insert(
            $this->table,
            [
                'created_at'  => $entry->createdAt ?? current_time('mysql', true),
                'reason'      => $entry->reason,
                'server_id'   => $entry->serverId,
                'site_id'     => $entry->siteId,
                'success'     => $entry->success ? 1 : 0,
                'http_code'   => $entry->httpCode,
                'duration_ms' => $entry->durationMs,
                'message'     => $entry->message,
            ],
            ['%s', '%s', '%s', '%s', '%d', '%d', '%d', '%s']
        );

        return (int) $wpdb->insert_id;
    }

    /**
     * @return list<FlushLogEntry>
     */
    public function recent(int $limit = self::RECENT_LIMIT): array
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Reading recent rows from our own custom log table (prepared with %i/%d); intentionally uncached so the audit view is always fresh.
        $rows = $wpdb->get_results(
            $wpdb->prepare('SELECT * FROM %i ORDER BY id DESC LIMIT %d', $this->table, $limit),
            ARRAY_A
        );

        if (! is_array($rows)) {
            return [];
        }

        $entries = [];

        foreach ($rows as $row) {
            if (is_array($row)) {
                $entries[] = FlushLogEntry::fromRow($row);
            }
        }

        return $entries;
    }

    public function prune(int $keep): void
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Reading the prune threshold from our own custom log table (prepared with %i/%d); a one-off maintenance read, not cached.
        $threshold = $wpdb->get_var(
            $wpdb->prepare('SELECT id FROM %i ORDER BY id DESC LIMIT 1 OFFSET %d', $this->table, $keep)
        );

        if (is_numeric($threshold)) {
            $delete = $wpdb->prepare('DELETE FROM %i WHERE id <= %d', $this->table, (int) $threshold);

            if (is_string($delete)) {
                // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $delete is a prepared DELETE against our own custom log table; a write with no caching.
                $wpdb->query($delete);
            }
        }
    }
}
