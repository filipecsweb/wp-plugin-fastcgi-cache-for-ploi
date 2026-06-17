<?php

/**
 * Uninstall routine for FastCGI Cache for Ploi.
 *
 * @package FastCgiCacheForPloi
 */

declare(strict_types=1);

use FastCgiCacheForPloi\Lifecycle\Uninstaller;
use WPForge\Plugin;

defined('WP_UNINSTALL_PLUGIN') || exit;

// Wrapped in an immediately-invoked closure so the autoload local never enters
// the global scope (WordPress.org Plugin Check flags global-scope plugin vars).
(static function (): void {
    $autoload = __DIR__ . '/vendor/autoload.php';

    if (! is_file($autoload)) {
        return;
    }

    require $autoload;

    // Derive the option prefix from the plugin header via the SAME rule the
    // runtime uses (Plugin::optionPrefix()), so a Text Domain change can never
    // leave uninstall deleting a stale, mismatched option name.
    Uninstaller::uninstall(Plugin::create(__DIR__ . '/fastcgi-cache-for-ploi.php')->optionPrefix());
})();
