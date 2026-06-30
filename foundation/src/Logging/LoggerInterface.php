<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation\Logging;

use Stringable;

/**
 * PSR-3-style logger interface (kept dependency-free; not the psr/log package).
 */
interface LoggerInterface
{
    /**
     * @param array<string, mixed> $context
     */
    public function log(string $level, string|Stringable $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function emergency(string|Stringable $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function alert(string|Stringable $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function critical(string|Stringable $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function error(string|Stringable $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function warning(string|Stringable $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function notice(string|Stringable $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function info(string|Stringable $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function debug(string|Stringable $message, array $context = []): void;
}
