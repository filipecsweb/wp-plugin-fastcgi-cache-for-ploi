<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation\Security;

/**
 * @since 1.0.0
 */
final class Sanitizer
{
    public function text(string $value): string
    {
        return sanitize_text_field($value);
    }

    public function textarea(string $value): string
    {
        return sanitize_textarea_field($value);
    }

    public function key(string $value): string
    {
        return sanitize_key($value);
    }

    public function slug(string $value): string
    {
        return sanitize_title($value);
    }

    public function email(string $value): string
    {
        return sanitize_email($value);
    }

    public function url(string $value): string
    {
        return esc_url_raw($value);
    }

    public function int(mixed $value): int
    {
        return (int) (is_scalar($value) ? $value : 0);
    }

    public function bool(mixed $value): bool
    {
        return (bool) filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @param array<mixed> $value
     *
     * @return list<string>
     */
    public function textList(array $value): array
    {
        return array_values(array_map(
            static fn (mixed $item): string => sanitize_text_field((string) (is_scalar($item) ? $item : '')),
            $value
        ));
    }
}
