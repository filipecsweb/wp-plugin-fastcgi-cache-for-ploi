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
     *     takes the global data as a builder, called only on the screen and printed as JSON.
     * @since 1.0.0
     *
     * @param non-empty-string                        $handle
     * @param (callable(): array<string, mixed>)|null $globalData Builds the data exposed to JS as the global $globalName.
     */
    public function enqueueOnScreen(
        string $pageHookSuffix,
        string $currentHookSuffix,
        string $entry,
        string $handle,
        string $globalName = '',
        ?callable $globalData = null,
        ?TextDomain $textDomain = null
    ): void {
        if ($pageHookSuffix === '' || $currentHookSuffix !== $pageHookSuffix) {
            return;
        }

        $this->vite->enqueueScript($entry, $handle);
        $textDomain?->loadForScript($handle);

        if ($globalName !== '' && $globalData !== null) {
            // A classic inline script before the module, so the module can read the global
            // on execution. WHY not wp_localize_script(): it turns every top-level scalar
            // into a string.
            wp_add_inline_script(
                $handle,
                sprintf('var %s = %s;', $globalName, wp_json_encode($globalData(), JSON_HEX_TAG)),
                'before'
            );
        }
    }
}
