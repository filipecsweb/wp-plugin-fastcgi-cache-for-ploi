<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Lifecycle;

use Ploi\FastCgiCache\Database\Migrations\CreateFlushLogTable;
use WPForge\Database\Migrator;

/**
 * Activation handler. Self-contained (no container) because activation runs
 * before the plugin's providers boot.
 */
final class Activator
{
    public static function activate(string $optionPrefix): void
    {
        (new Migrator($optionPrefix . '_migrations'))->migrate([new CreateFlushLogTable()]);
    }
}
