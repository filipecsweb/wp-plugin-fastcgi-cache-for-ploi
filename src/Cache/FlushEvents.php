<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Cache;

/**
 * The canonical list of content-change events that can trigger a cache flush.
 *
 * Single source of truth shared by the settings UI (toggles) and the hook
 * subscriber. keys()/defaults() are translation-free so they are safe to call
 * before the init action (e.g. when building the settings option defaults during
 * plugins_loaded); all() adds translated labels and must only be called once
 * translations are available (init or later).
 */
final class FlushEvents
{
    /**
     * Event key => default-enabled. The source of truth for which events exist.
     */
    private const EVENTS = [
        'post_save'   => true,
        'post_delete' => true,
        'comment'     => true,
        'theme'       => true,
        'customizer'  => true,
        'menu'        => true,
    ];

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::EVENTS);
    }

    /**
     * Default enabled-state map (key => bool). Translation-free.
     *
     * @return array<string, bool>
     */
    public static function defaults(): array
    {
        return self::EVENTS;
    }

    /**
     * The labelled list for the settings UI. Calls __(), so only safe at/after init.
     *
     * @return list<array{key: string, label: string, description: string, default: bool}>
     */
    public static function all(): array
    {
        $meta = [
            'post_save'   => [
                __('Post published or updated', 'ploi-fastcgi-cache'),
                __('A published post, page or custom post type is created, updated, or changes status.', 'ploi-fastcgi-cache'),
            ],
            'post_delete' => [
                __('Post deleted', 'ploi-fastcgi-cache'),
                __('A published post is moved to trash or permanently deleted.', 'ploi-fastcgi-cache'),
            ],
            'comment'     => [
                __('Comment posted or moderated', 'ploi-fastcgi-cache'),
                __('A comment is submitted, approved, unapproved, spammed or deleted.', 'ploi-fastcgi-cache'),
            ],
            'theme'       => [
                __('Theme switched', 'ploi-fastcgi-cache'),
                __('The active theme changes.', 'ploi-fastcgi-cache'),
            ],
            'customizer'  => [
                __('Customizer changes published', 'ploi-fastcgi-cache'),
                __('Customizer settings are saved.', 'ploi-fastcgi-cache'),
            ],
            'menu'        => [
                __('Navigation menu updated', 'ploi-fastcgi-cache'),
                __('A navigation menu is created or updated.', 'ploi-fastcgi-cache'),
            ],
        ];

        $events = [];

        foreach (self::EVENTS as $key => $default) {
            $events[] = [
                'key'         => $key,
                'label'       => $meta[$key][0],
                'description' => $meta[$key][1],
                'default'     => $default,
            ];
        }

        return $events;
    }
}
