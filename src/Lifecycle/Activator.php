<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Lifecycle;

use FastCgiCacheForPloi\Database\Migrations\CreateFlushLogTable;
use FastCgiCacheForPloi\Settings\OptionNames;
use WPForge\Database\Migrator;

/**
 * Activation handler. Self-contained (no container) because activation runs
 * before the plugin's providers boot.
 */
final class Activator
{
    public static function activate(string $optionPrefix): void
    {
        (new Migrator(OptionNames::migrations($optionPrefix)))->migrate([new CreateFlushLogTable()]);
    }
}
