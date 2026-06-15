<?php

declare(strict_types=1);

namespace WPForge\Lifecycle;

/**
 * Thin wrapper over WordPress activation/deactivation hooks.
 *
 * Uninstall is intentionally NOT handled here: register_uninstall_hook() cannot
 * accept closures or instance methods, so uninstall is driven by the canonical
 * uninstall.php file at the plugin root (added in Phase 4).
 */
final class Lifecycle
{
    public function __construct(private readonly string $file)
    {
    }

    /**
     * @param callable(): void $callback
     */
    public function onActivate(callable $callback): void
    {
        register_activation_hook($this->file, $callback);
    }

    /**
     * @param callable(): void $callback
     */
    public function onDeactivate(callable $callback): void
    {
        register_deactivation_hook($this->file, $callback);
    }
}
