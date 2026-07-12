<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation\Security;

/**
 * @since 1.0.0
 */
final class Nonce
{
    public function create(string $action): string
    {
        return wp_create_nonce($action);
    }

    public function verify(string $nonce, string $action): bool
    {
        return wp_verify_nonce($nonce, $action) !== false;
    }

    public function field(string $action, string $name = '_wpnonce', bool $referer = true): string
    {
        return wp_nonce_field($action, $name, $referer, false);
    }
}
