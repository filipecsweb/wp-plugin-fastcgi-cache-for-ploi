<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Ploi;

use WPForge\Http\HttpClient;
use WPForge\Http\Response;

// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- PloiApiException::fromResponse() receives a Response object (esc_html is inapplicable); its message is surfaced as an escaped WP_Error/JSON response and escaped at output, not here.

/**
 * Thin client for the Ploi API, built on the Foundation HTTP wrapper.
 *
 * The token is passed per call (never stored on the client) so a single shared
 * instance can serve different tokens (e.g. a just-entered token during "Test
 * connection" vs the saved one).
 */
final class PloiClient
{
    private const BASE_URL = 'https://ploi.io';

    /**
     * Page size for Ploi list endpoints — fetch the full list in one request.
     */
    private const PER_PAGE = 100;

    public function __construct(private readonly HttpClient $http)
    {
    }

    /**
     * @return list<array<string, string>>
     */
    public function servers(string $token): array
    {
        $response = $this->authed($token)->get('/api/servers', ['per_page' => self::PER_PAGE]);

        if (! $response->ok()) {
            throw PloiApiException::fromResponse($response);
        }

        return $this->mapList($response->array(), 'name', 'name');
    }

    /**
     * @return list<array<string, string>>
     */
    public function sites(string $token, string $serverId): array
    {
        $response = $this->authed($token)->get(
            sprintf('/api/servers/%s/sites', rawurlencode($serverId)),
            ['per_page' => self::PER_PAGE]
        );

        if (! $response->ok()) {
            throw PloiApiException::fromResponse($response);
        }

        return $this->mapList($response->array(), 'domain', 'domain');
    }

    public function flush(string $serverId, string $siteId, string $token): Response
    {
        return $this->authed($token)->post(sprintf(
            '/api/servers/%s/sites/%s/fastcgi-cache/flush',
            rawurlencode($serverId),
            rawurlencode($siteId)
        ));
    }

    private function authed(string $token): HttpClient
    {
        return $this->http
            ->withBaseUrl(self::BASE_URL)
            ->withToken($token)
            ->withTimeout(20);
    }

    /**
     * @param array<mixed> $payload
     *
     * @return list<array<string, string>>
     */
    private function mapList(array $payload, string $labelKey, string $outKey): array
    {
        $rows = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : $payload;
        $out  = [];

        foreach ($rows as $row) {
            if (! is_array($row) || ! isset($row['id']) || ! is_scalar($row['id'])) {
                continue;
            }

            $id    = (string) $row['id'];
            $label = isset($row[$labelKey]) && is_scalar($row[$labelKey]) ? (string) $row[$labelKey] : $id;

            $out[] = ['id' => $id, $outKey => $label];
        }

        return $out;
    }
}
