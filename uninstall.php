<?php

/**
 * Uninstall routine for Ploi FastCGI Cache.
 *
 * @package Ploi\FastCgiCache
 */

declare(strict_types=1);

use Ploi\FastCgiCache\Lifecycle\Uninstaller;

defined('WP_UNINSTALL_PLUGIN') || exit;

$ploi_fastcgi_cache_autoload = __DIR__ . '/vendor/autoload.php';

if (is_file($ploi_fastcgi_cache_autoload)) {
    require $ploi_fastcgi_cache_autoload;

    Uninstaller::uninstall('ploi_fastcgi_cache');
}
