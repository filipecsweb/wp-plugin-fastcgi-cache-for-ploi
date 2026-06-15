<?php

declare(strict_types=1);

namespace WPForge\Http;

use WP_Error;

/**
 * An immutable HTTP response value object wrapping a wp_remote_* result.
 */
final class Response
{
    /**
     * @param array<array-key, mixed> $headers
     */
    public function __construct(
        private readonly int $status,
        private readonly string $body,
        private readonly array $headers = [],
        private readonly ?string $error = null,
    ) {
    }

    public static function fromError(WP_Error $error): self
    {
        return new self(0, '', [], $error->get_error_message());
    }

    public function status(): int
    {
        return $this->status;
    }

    public function ok(): bool
    {
        return $this->error === null && $this->status >= 200 && $this->status < 300;
    }

    public function failed(): bool
    {
        return ! $this->ok();
    }

    public function body(): string
    {
        return $this->body;
    }

    public function error(): ?string
    {
        return $this->error;
    }

    /**
     * @return array<array-key, mixed>
     */
    public function headers(): array
    {
        return $this->headers;
    }

    public function json(): mixed
    {
        if ($this->body === '') {
            return null;
        }

        return json_decode($this->body, true);
    }

    /**
     * @return array<mixed>
     */
    public function array(): array
    {
        $decoded = $this->json();

        return is_array($decoded) ? $decoded : [];
    }
}
