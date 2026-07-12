<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Log;

use FastCgiCacheForPloi\Cache\FlushReason;

/**
 * Column order is locked: it backs the on-disk table schema.
 *
 * @since 1.0.0
 */
final class FlushLogEntry
{
    /**
     * @since 1.0.0
     */
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

    /**
     * @since 1.0.0
     */
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
     * @since 1.0.0
     *
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
     * @since 1.0.0
     *
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
            'hint'         => self::failureHint($this->httpCode),
        ];
    }

    /**
     * Human-readable diagnostic for a failed flush, keyed by HTTP status.
     *
     * Single source of truth: both the immediate "Flush now" notice
     * (FlushController::failureNotice()) and the serialized log row consume this,
     * so the two can never diverge. Phrased as a tense-neutral DIAGNOSTIC — never
     * an imperative — so the same string reads correctly both in the notice shown
     * the instant a flush fails AND in a historical log row, and never goes stale
     * the way an instruction ("re-test your token") would once the token or target
     * is fixed. Returns null for codes we have no specific gloss for; callers fall
     * back to the raw Ploi message.
     *
     * Ploi answers 422 on the flush endpoint when the site has no FastCGI cache to
     * flush, and its raw "The given data was invalid." is opaque; we can't prove
     * 422 is exclusive to that case, so we hedge ("may not be enabled"). Bad
     * server/site IDs return 404, not 422.
     *
     * @since 1.0.0
     */
    public static function failureHint(int $httpCode): ?string
    {
        return match ($httpCode) {
            401 => __('Ploi rejected the token as wrong or expired.', 'fastcgi-cache-for-ploi'),
            404 => __('Ploi could not find the server or site — it may have been deleted.', 'fastcgi-cache-for-ploi'),
            422 => __('Ploi rejected the flush — FastCGI caching may not be enabled for this site.', 'fastcgi-cache-for-ploi'),
            default => null,
        };
    }

    /**
     * @since 1.0.0
     */
    private static function asString(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
    }

    /**
     * @since 1.0.0
     */
    private static function asInt(mixed $value): int
    {
        return is_numeric($value) ? (int) $value : 0;
    }
}
