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

$fastcgi_cache_for_ploi_autoload = __DIR__ . '/vendor/autoload.php';

if (is_file($fastcgi_cache_for_ploi_autoload)) {
    require $fastcgi_cache_for_ploi_autoload;

    // Derive the option prefix from the plugin header via the SAME rule the
    // runtime uses (Plugin::optionPrefix()), so a Text Domain change can never
    // leave uninstall deleting a stale, mismatched option name.
    Uninstaller::uninstall(Plugin::create(__DIR__ . '/fastcgi-cache-for-ploi.php')->optionPrefix());
}
