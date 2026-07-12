<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Lifecycle;

use FastCgiCacheForPloi\Database\Migrations\CreateFlushLogTable;
use FastCgiCacheForPloi\Settings\OptionNames;
use FastCgiCacheForPloi\Foundation\Database\Migrator;

/**
 * No container: activation fires before the plugin's providers boot.
 *
 * @since 1.0.0
 */
final class Activator
{
    public static function activate(string $optionPrefix): void
    {
        (new Migrator(OptionNames::migrations($optionPrefix)))->migrate([new CreateFlushLogTable()]);
    }
}
