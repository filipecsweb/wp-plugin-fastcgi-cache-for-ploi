<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Cache;

use FastCgiCacheForPloi\Log\FlushLogEntry;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Ploi\PloiApiException;
use FastCgiCacheForPloi\Ploi\PloiClient;
use FastCgiCacheForPloi\Settings\PloiSettings;
use WPForge\Logging\LoggerInterface;

/**
 * Performs a single flush: calls the Ploi API, times it, and records the result.
 *
 * If the plugin is not fully configured (no usable token / server / site) the
 * flush is a clean no-op — it logs a debug line and returns null, never errors.
 */
final class CacheFlusher
{
    private const KEEP_LOG_ROWS = 100;

    public function __construct(
        private readonly PloiSettings $settings,
        private readonly PloiClient $client,
        private readonly FlushLogRepository $log,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function flush(FlushReason $reason): ?FlushLogEntry
    {
        $token    = $this->settings->token();
        $serverId = $this->settings->serverId();
        $siteId   = $this->settings->siteId();

        if ($token === null || $serverId === '' || $siteId === '') {
            $this->logger->debug('Ploi flush skipped: not configured (reason={reason}).', ['reason' => $reason->value]);

            return null;
        }

        $start      = microtime(true);
        $response   = $this->client->flush($serverId, $siteId, $token);
        $durationMs = (int) round((microtime(true) - $start) * 1000);

        $entry = new FlushLogEntry(
            reason: $reason->value,
            serverId: $serverId,
            siteId: $siteId,
            success: $response->ok(),
            httpCode: $response->status(),
            durationMs: $durationMs,
            message: $response->ok() ? null : PloiApiException::messageFromResponse($response),
            createdAt: current_time('mysql', true),
        );

        $id = $this->log->insert($entry);
        $this->log->prune(self::KEEP_LOG_ROWS);

        if ($response->ok()) {
            $this->logger->info('Ploi cache flushed ({reason}, {ms}ms).', ['reason' => $reason->value, 'ms' => $durationMs]);
        } else {
            $this->logger->warning('Ploi cache flush failed ({reason}, HTTP {code}).', ['reason' => $reason->value, 'code' => $response->status()]);
        }

        return $entry->withId($id);
    }
}
