<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation\Security;

final class Capability
{
    public function can(string $capability, mixed ...$args): bool
    {
        return current_user_can($capability, ...$args);
    }
}
