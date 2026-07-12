<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation\Security;

/**
 * @since 1.0.0
 */
final class Capability
{
    public function can(string $capability, mixed ...$args): bool
    {
        return current_user_can($capability, ...$args);
    }
}
