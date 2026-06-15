<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Ploi;

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
                __('Your Ploi API token was rejected. Check the token and try again.', 'ploi-fastcgi-cache'),
                $status
            );
        }

        $data    = $response->array();
        $message = isset($data['message']) && is_string($data['message']) && $data['message'] !== ''
            ? $data['message']
            : ($response->error() ?? sprintf(
                /* translators: %d: HTTP status code. */
                __('The Ploi API request failed (HTTP %d).', 'ploi-fastcgi-cache'),
                $status
            ));

        return new self($message, $status);
    }
}
