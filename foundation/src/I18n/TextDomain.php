<?php

declare(strict_types=1);

namespace WPForge\I18n;

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
        load_plugin_textdomain($this->domain, false, $this->relativePath);
    }
}
