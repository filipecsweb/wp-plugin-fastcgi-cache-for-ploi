<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Settings;

/**
 * The names of the WordPress option rows this plugin owns, built from the
 * plugin's option prefix (Plugin::optionPrefix()).
 *
 * Single source so the WRITE sites (CoreServiceProvider, which binds Options +
 * Migrator) and the TEARDOWN sites (Activator, Uninstaller) can never disagree:
 * a drifted suffix would orphan an option row on uninstall, which the plugin's
 * "no orphans left in the DB" rule forbids.
 *
 * @since 1.0.0
 */
final class OptionNames
{
    /**
     * @since 1.0.0
     */
    public const SETTINGS_SUFFIX   = '_settings';
    /**
     * @since 1.0.0
     */
    public const MIGRATIONS_SUFFIX = '_migrations';

    /**
     * @since 1.0.0
     */
    public static function settings(string $prefix): string
    {
        return $prefix . self::SETTINGS_SUFFIX;
    }

    /**
     * @since 1.0.0
     */
    public static function migrations(string $prefix): string
    {
        return $prefix . self::MIGRATIONS_SUFFIX;
    }
}
