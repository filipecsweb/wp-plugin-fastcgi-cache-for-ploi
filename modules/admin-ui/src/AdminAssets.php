<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Module\AdminUi;

use FastCgiCacheForPloi\Foundation\Assets\Vite;
use FastCgiCacheForPloi\Foundation\I18n\TextDomain;

/**
 * Enqueues a Vite-built admin bundle, scoped to a single admin screen, so it
 * never loads on any other wp-admin page.
 *
 * @since 1.0.0
 */
final class AdminAssets
{
    /**
     * @since 1.0.0
     */
    public function __construct(private readonly Vite $vite)
    {
    }

    /**
     * @since 1.1.0 Registers the script's translations when a text domain is passed, and
     *     takes the localized data as a builder, called only on the screen.
     * @since 1.0.0
     *
     * @param non-empty-string                        $handle
     * @param (callable(): array<string, mixed>)|null $localize Builds the data exposed to JS as a global object.
     */
    public function enqueueOnScreen(
        string $pageHookSuffix,
        string $currentHookSuffix,
        string $entry,
        string $handle,
        string $localizeObject = '',
        ?callable $localize = null,
        ?TextDomain $textDomain = null
    ): void {
        if ($pageHookSuffix === '' || $currentHookSuffix !== $pageHookSuffix) {
            return;
        }

        $this->vite->enqueueScript($entry, $handle);
        $textDomain?->loadForScript($handle);

        if ($localizeObject !== '' && $localize !== null) {
            // Printed as a classic inline script before the module, so the module
            // can read window.{localizeObject} on execution.
            wp_localize_script($handle, $localizeObject, $localize());
        }
    }
}
