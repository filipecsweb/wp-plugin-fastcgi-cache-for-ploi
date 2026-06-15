<?php

declare(strict_types=1);

namespace WPForge\Security;

/**
 * Capability checks.
 */
final class Capability
{
    public function can(string $capability, mixed ...$args): bool
    {
        return current_user_can($capability, ...$args);
    }
}
