<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Cache;

/**
 * The canonical list of content-change events that can trigger a cache flush.
 *
 * Single source of truth shared by the settings UI (toggles) and, in Phase 4,
 * the hook subscriber that maps each WordPress hook to one of these keys.
 */
final class FlushEvents
{
    /**
     * @return list<array{key: string, label: string, description: string, default: bool}>
     */
    public static function all(): array
    {
        return [
            [
                'key'         => 'post_save',
                'label'       => __('Post published or updated', 'ploi-fastcgi-cache'),
                'description' => __('A published post, page or custom post type is created, updated, or changes status.', 'ploi-fastcgi-cache'),
                'default'     => true,
            ],
            [
                'key'         => 'post_delete',
                'label'       => __('Post deleted', 'ploi-fastcgi-cache'),
                'description' => __('A published post is moved to trash or permanently deleted.', 'ploi-fastcgi-cache'),
                'default'     => true,
            ],
            [
                'key'         => 'comment',
                'label'       => __('Comment posted or moderated', 'ploi-fastcgi-cache'),
                'description' => __('A comment is submitted, approved, unapproved, spammed or deleted.', 'ploi-fastcgi-cache'),
                'default'     => true,
            ],
            [
                'key'         => 'theme',
                'label'       => __('Theme switched', 'ploi-fastcgi-cache'),
                'description' => __('The active theme changes.', 'ploi-fastcgi-cache'),
                'default'     => true,
            ],
            [
                'key'         => 'customizer',
                'label'       => __('Customizer changes published', 'ploi-fastcgi-cache'),
                'description' => __('Customizer settings are saved.', 'ploi-fastcgi-cache'),
                'default'     => true,
            ],
            [
                'key'         => 'menu',
                'label'       => __('Navigation menu updated', 'ploi-fastcgi-cache'),
                'description' => __('A navigation menu is created or updated.', 'ploi-fastcgi-cache'),
                'default'     => true,
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_map(static fn (array $event): string => $event['key'], self::all());
    }

    /**
     * Default enabled-state map (key => bool).
     *
     * @return array<string, bool>
     */
    public static function defaults(): array
    {
        $defaults = [];

        foreach (self::all() as $event) {
            $defaults[$event['key']] = $event['default'];
        }

        return $defaults;
    }
}
