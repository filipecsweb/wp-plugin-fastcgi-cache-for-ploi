<?php

/**
 * Plugin Name:       FastCGI Cache for Ploi
 * Plugin URI:        https://github.com/filipeseabra/ploi-fastcgi-cache
 * Description:       Automatically flush a Ploi-managed site's FastCGI cache when content changes.
 * Version:           1.0.0
 * Requires at least: 6.5
 * Requires PHP:      8.2
 * Author:            Filipe Seabra
 * Author URI:        https://github.com/filipeseabra
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       ploi-fastcgi-cache
 * Domain Path:       /languages
 *
 * @package Ploi\FastCgiCache
 *
 * This header is the SINGLE SOURCE OF TRUTH for the plugin version. The WPForge
 * kernel reads it at runtime via get_file_data() — never hardcode the version
 * anywhere else.
 */

declare(strict_types=1);

namespace Ploi\FastCgiCache;

use Ploi\FastCgiCache\Lifecycle\Activator;
use Ploi\FastCgiCache\Lifecycle\Deactivator;
use Ploi\FastCgiCache\Providers\AdminServiceProvider;
use Ploi\FastCgiCache\Providers\CoreServiceProvider;
use Ploi\FastCgiCache\Providers\FlushServiceProvider;
use Ploi\FastCgiCache\Providers\RestServiceProvider;
use WPForge\Lifecycle\Lifecycle;
use WPForge\Module\AdminUi\AdminUiModule;
use WPForge\Plugin;

defined('ABSPATH') || exit;

$ploi_fastcgi_cache_autoload = __DIR__ . '/vendor/autoload.php';

if (! is_file($ploi_fastcgi_cache_autoload)) {
    add_action('admin_notices', static function (): void {
        echo '<div class="notice notice-error"><p>';
        echo esc_html__(
            'FastCGI Cache for Ploi: dependencies are missing. Run "composer install" in the plugin directory.',
            'ploi-fastcgi-cache'
        );
        echo '</p></div>';
    });

    return;
}

require $ploi_fastcgi_cache_autoload;

/**
 * Boot the plugin on top of the WPForge Foundation.
 *
 *   - Phase 3 (admin-ui module): the settings screen, loaded only in wp-admin.
 *   - Phase 4 (Ploi behaviour):  always-on core, REST and flush providers via
 *     withProviders(), plus activation/deactivation via withLifecycle() — wired
 *     synchronously here (never in a provider), because WordPress fires
 *     activation hooks without re-running plugins_loaded.
 */
$ploi_fastcgi_cache = Plugin::create(__FILE__);

// Always-on services: core bindings, REST routes, and the flush/event engine.
$ploi_fastcgi_cache->withProviders([
    CoreServiceProvider::class,
    RestServiceProvider::class,
    FlushServiceProvider::class,
]);

// Admin settings screen — loads only in wp-admin.
$ploi_fastcgi_cache->withModule(new AdminUiModule([
    AdminServiceProvider::class,
]));

// Activation/deactivation must be wired synchronously, before the plugins_loaded
// deferral, because WordPress fires activation hooks without re-running it.
$ploi_fastcgi_cache->withLifecycle(static function (Lifecycle $lifecycle) use ($ploi_fastcgi_cache): void {
    $prefix = $ploi_fastcgi_cache->optionPrefix();
    $lifecycle->onActivate(static fn () => Activator::activate($prefix));
    $lifecycle->onDeactivate(static fn () => Deactivator::deactivate());
});

add_action('plugins_loaded', static function () use ($ploi_fastcgi_cache): void {
    $ploi_fastcgi_cache->boot();
});
