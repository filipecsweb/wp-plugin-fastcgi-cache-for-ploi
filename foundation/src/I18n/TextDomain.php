<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation\I18n;

/**
 * Loads the plugin's translations.
 */
final class TextDomain
{
    public function __construct(
        private readonly string $domain,
        private readonly string $relativePath,
    ) {
    }

    public function load(): void
    {
        // phpcs:ignore PluginCheck.CodeAnalysis.DiscouragedFunctions.load_plugin_textdomainFound -- Retained so bundled /languages translations load on installs outside wordpress.org; on wordpress.org, translations also auto-load by slug.
        load_plugin_textdomain($this->domain, false, $this->relativePath);
    }
}
