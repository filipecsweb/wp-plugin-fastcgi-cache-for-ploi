<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Ploi;

use RuntimeException;
use WPForge\Http\Response;

/**
 * Raised when the Ploi API returns an error response.
 */
final class PloiApiException extends RuntimeException
{
    public function __construct(string $message, private readonly int $statusCode = 0)
    {
        parent::__construct($message);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    public static function fromResponse(Response $response): self
    {
        $status = $response->status();

        if ($status === 401 || $status === 403) {
            return new self(
                __('Your Ploi API token was rejected. Check the token and try again.', 'fastcgi-cache-for-ploi'),
                $status
            );
        }

        return new self(self::messageFromResponse($response), $status);
    }

    /**
     * Resolve a human-readable message from a Ploi error response: the API's own
     * "message" field if present, then the transport-level error, then a generic
     * HTTP-status line. The single home for parsing Ploi's error envelope, shared
     * by fromResponse() (Test connection / listing) and CacheFlusher (the flush
     * log) so the two can't drift.
     */
    public static function messageFromResponse(Response $response): string
    {
        $data = $response->array();

        if (isset($data['message']) && is_string($data['message']) && $data['message'] !== '') {
            return $data['message'];
        }

        return $response->error() ?? sprintf(
            /* translators: %d: HTTP status code. */
            __('The Ploi API request failed (HTTP %d).', 'fastcgi-cache-for-ploi'),
            $response->status()
        );
    }
}
