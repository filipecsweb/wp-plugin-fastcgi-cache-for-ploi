<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Module\AdminUi;

use FastCgiCacheForPloi\Foundation\Assets\Vite;

/**
 * Enqueues a Vite-built admin bundle, scoped to a single admin screen.
 *
 * Scoping to one hook suffix is what keeps the Tailwind bundle off every other
 * wp-admin page. Combined with the admin-ui module's Tailwind v4 setup
 * (preflight excluded, tw: prefix, utilities in a low-priority cascade layer),
 * wp-admin styling stays untouched.
 */
final class AdminAssets
{
    public function __construct(private readonly Vite $vite)
    {
    }

    /**
     * @param array<string, mixed> $localize Data exposed to JS as a global object.
     */
    public function enqueueOnScreen(
        string $pageHookSuffix,
        string $currentHookSuffix,
        string $entry,
        string $handle,
        string $localizeObject = '',
        array $localize = []
    ): void {
        if ($pageHookSuffix === '' || $currentHookSuffix !== $pageHookSuffix) {
            return;
        }

        $this->vite->enqueueScript($entry, $handle);

        if ($localizeObject !== '' && $localize !== []) {
            // Printed as a classic inline script before the module, so the module
            // can read window.{localizeObject} on execution.
            wp_localize_script($handle, $localizeObject, $localize);
        }
    }
}
