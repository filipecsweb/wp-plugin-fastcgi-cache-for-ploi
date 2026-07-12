<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Cache;

/**
 * GOTCHA: keys()/defaults() are __()-free (safe pre-init); all()/description()
 * call __() and require init.
 *
 * @since 1.0.0
 */
final class FlushEvents
{
    /**
     * i18n: __()-free, safe before init.
     *
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_map(static fn (FlushReason $reason): string => $reason->value, FlushReason::autoCases());
    }

    /**
     * i18n: __()-free, safe before init.
     *
     * @return array<string, bool>
     */
    public static function defaults(): array
    {
        return array_fill_keys(self::keys(), true);
    }

    /**
     * i18n: calls __(), only safe at/after init.
     *
     * @return list<array{key: string, label: string, description: string, default: bool}>
     */
    public static function all(): array
    {
        $events = [];

        foreach (FlushReason::autoCases() as $reason) {
            $events[] = [
                'key'         => $reason->value,
                'label'       => $reason->label(),
                'description' => self::description($reason),
                'default'     => true,
            ];
        }

        return $events;
    }

    /**
     * i18n: calls __(), only safe at/after init; Manual has no toggle so returns ''.
     */
    private static function description(FlushReason $reason): string
    {
        return match ($reason) {
            FlushReason::PostSave   => __('A published post, page or custom post type is created, updated, or changes status.', 'fastcgi-cache-for-ploi'),
            FlushReason::PostDelete => __('A published post is moved to trash or permanently deleted.', 'fastcgi-cache-for-ploi'),
            FlushReason::Comment    => __('A comment is submitted, approved, unapproved, spammed or deleted.', 'fastcgi-cache-for-ploi'),
            FlushReason::Theme      => __('The active theme changes.', 'fastcgi-cache-for-ploi'),
            FlushReason::Customizer => __('Customizer settings are saved.', 'fastcgi-cache-for-ploi'),
            FlushReason::Menu       => __('A navigation menu is created or updated.', 'fastcgi-cache-for-ploi'),
            FlushReason::Manual     => '',
        };
    }
}
