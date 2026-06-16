<?php

/**
 * Uninstall routine for FastCGI Cache for Ploi.
 *
 * @package Ploi\FastCgiCache
 */

declare(strict_types=1);

use Ploi\FastCgiCache\Lifecycle\Uninstaller;
use WPForge\Plugin;

defined('WP_UNINSTALL_PLUGIN') || exit;

$ploi_fastcgi_cache_autoload = __DIR__ . '/vendor/autoload.php';

if (is_file($ploi_fastcgi_cache_autoload)) {
    require $ploi_fastcgi_cache_autoload;

    // Derive the option prefix from the plugin header via the SAME rule the
    // runtime uses (Plugin::optionPrefix()), so a Text Domain change can never
    // leave uninstall deleting a stale, mismatched option name.
    Uninstaller::uninstall(Plugin::create(__DIR__ . '/ploi-fastcgi-cache.php')->optionPrefix());
}
