<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Log;

use Ploi\FastCgiCache\Cache\FlushReason;

/**
 * One row of the flush log.
 *
 * Locked column shape: timestamp, trigger (event key or "manual"), server, site,
 * status, HTTP code, duration, and an optional message.
 */
final class FlushLogEntry
{
    public function __construct(
        public readonly string $reason,
        public readonly string $serverId,
        public readonly string $siteId,
        public readonly bool $success,
        public readonly int $httpCode,
        public readonly int $durationMs,
        public readonly ?string $message = null,
        public readonly ?int $id = null,
        public readonly ?string $createdAt = null,
    ) {
    }

    public function withId(int $id): self
    {
        return new self(
            $this->reason,
            $this->serverId,
            $this->siteId,
            $this->success,
            $this->httpCode,
            $this->durationMs,
            $this->message,
            $id,
            $this->createdAt,
        );
    }

    /**
     * @param array<array-key, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        $message = $row['message'] ?? null;

        return new self(
            reason: self::asString($row['reason'] ?? ''),
            serverId: self::asString($row['server_id'] ?? ''),
            siteId: self::asString($row['site_id'] ?? ''),
            success: self::asInt($row['success'] ?? 0) === 1,
            httpCode: self::asInt($row['http_code'] ?? 0),
            durationMs: self::asInt($row['duration_ms'] ?? 0),
            message: is_scalar($message) && (string) $message !== '' ? (string) $message : null,
            id: isset($row['id']) ? self::asInt($row['id']) : null,
            createdAt: isset($row['created_at']) ? self::asString($row['created_at']) : null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $created    = $this->createdAt ?? (string) current_time('mysql', true);
        $dateFormat = self::asString(get_option('date_format', 'Y-m-d'));
        $timeFormat = self::asString(get_option('time_format', 'H:i'));
        $format     = sprintf(
            '%s %s',
            $dateFormat !== '' ? $dateFormat : 'Y-m-d',
            $timeFormat !== '' ? $timeFormat : 'H:i'
        );

        return [
            'id'           => $this->id,
            'created_at'   => mysql2date($format, get_date_from_gmt($created)),
            'reason'       => $this->reason,
            'reason_label' => FlushReason::tryFrom($this->reason)?->label() ?? $this->reason,
            'server_id'    => $this->serverId,
            'site_id'      => $this->siteId,
            'success'      => $this->success,
            'http_code'    => $this->httpCode,
            'duration_ms'  => $this->durationMs,
            'message'      => $this->message,
        ];
    }

    private static function asString(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
    }

    private static function asInt(mixed $value): int
    {
        return is_numeric($value) ? (int) $value : 0;
    }
}
