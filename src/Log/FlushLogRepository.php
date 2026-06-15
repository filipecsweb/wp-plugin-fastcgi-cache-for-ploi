<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Log;

/**
 * Reads and writes flush-log rows in the custom table created by the migration.
 *
 * The table name is derived from $wpdb->prefix (trusted), never user input, so
 * interpolating it into queries is safe; values always use $wpdb->prepare().
 */
final class FlushLogRepository
{
    public const TABLE = 'ploi_flush_log';

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
    public function recent(int $limit = 20): array
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

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

    /**
     * Keep only the newest $keep rows.
     */
    public function prune(int $keep): void
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        $threshold = $wpdb->get_var(
            $wpdb->prepare('SELECT id FROM %i ORDER BY id DESC LIMIT 1 OFFSET %d', $this->table, $keep)
        );

        if (is_numeric($threshold)) {
            $delete = $wpdb->prepare('DELETE FROM %i WHERE id <= %d', $this->table, (int) $threshold);

            if (is_string($delete)) {
                // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $delete holds a prepared query.
                $wpdb->query($delete);
            }
        }
    }

    public function count(): int
    {
        /** @var \wpdb $wpdb */
        global $wpdb;

        $count = $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM %i', $this->table));

        return is_numeric($count) ? (int) $count : 0;
    }
}
