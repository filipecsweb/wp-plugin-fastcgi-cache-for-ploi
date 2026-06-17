<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Cache;

/**
 * The content-change events that can trigger a cache flush, as the settings UI
 * sees them: key + label + description + default-enabled flag.
 *
 * The event KEYS and LABELS are owned by FlushReason (the canonical enum);
 * FlushEvents derives them via FlushReason::autoCases()/label() so the two can
 * never drift. FlushEvents itself owns only the per-event description text and
 * the default-enabled flag. keys()/defaults() are translation-free so they are
 * safe before the init action (e.g. building option defaults during
 * plugins_loaded); all() and description() call __() and must only run at/after
 * init.
 */
final class FlushEvents
{
    /**
     * The event keys (= the FlushReason auto-case values). Translation-free.
     *
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_map(static fn (FlushReason $reason): string => $reason->value, FlushReason::autoCases());
    }

    /**
     * Default enabled-state map (key => bool); every event defaults to enabled.
     * Translation-free.
     *
     * @return array<string, bool>
     */
    public static function defaults(): array
    {
        return array_fill_keys(self::keys(), true);
    }

    /**
     * The labelled list for the settings UI. Reads keys + labels from FlushReason
     * and adds this plugin's per-event descriptions. Calls __(), so only safe
     * at/after init.
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
     * The settings-UI description for an event. Calls __(), so only safe at/after
     * init. Manual has no toggle and therefore no description.
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
