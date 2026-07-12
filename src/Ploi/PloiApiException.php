<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Ploi;

use RuntimeException;
use FastCgiCacheForPloi\Foundation\Http\Response;

/**
 * @since 1.0.0
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

        if ($status === 401) {
            return new self(
                __('Your Ploi API token was rejected. Check the token and try again.', 'fastcgi-cache-for-ploi'),
                $status
            );
        }

        if ($status === 403) {
            return new self(
                __('This Ploi API token is missing a required permission. Use a token with the Servers and Sites scopes.', 'fastcgi-cache-for-ploi'),
                $status
            );
        }

        return new self(self::messageFromResponse($response), $status);
    }

    /**
     * Single home for parsing Ploi's error envelope; shared by fromResponse() and
     * CacheFlusher so messages can't drift.
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
