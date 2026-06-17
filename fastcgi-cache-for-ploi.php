<?php

/**
 * Plugin Name:       FastCGI Cache for Ploi
 * Plugin URI:        https://wordpress.org/plugins/fastcgi-cache-for-ploi/
 * Description:       Automatically flush a Ploi-managed site's FastCGI cache when content changes.
 * Version:           1.0.0
 * Requires at least: 6.5
 * Requires PHP:      8.2
 * Author:            Filipe Seabra
 * Author URI:        https://github.com/filipecsweb
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       fastcgi-cache-for-ploi
 * Domain Path:       /languages
 *
 * @package FastCgiCacheForPloi
 *
 * This header is the SINGLE SOURCE OF TRUTH for the plugin version. The WPForge
 * kernel reads it at runtime via get_file_data() — never hardcode the version
 * anywhere else.
 */

declare(strict_types=1);

namespace FastCgiCacheForPloi;

use FastCgiCacheForPloi\Lifecycle\Activator;
use FastCgiCacheForPloi\Lifecycle\Deactivator;
use FastCgiCacheForPloi\Providers\AdminServiceProvider;
use FastCgiCacheForPloi\Providers\CoreServiceProvider;
use FastCgiCacheForPloi\Providers\FlushServiceProvider;
use FastCgiCacheForPloi\Providers\RestServiceProvider;
use WPForge\Lifecycle\Lifecycle;
use WPForge\Module\AdminUi\AdminUiModule;
use WPForge\Plugin;

defined('ABSPATH') || exit;

/**
 * Boot the plugin on top of the WPForge Foundation.
 *
 *   - Admin-UI module: the settings screen, loaded only in wp-admin.
 *   - Ploi behaviour:  always-on core, REST and flush providers via
 *     withProviders(), plus activation/deactivation via withLifecycle() — wired
 *     synchronously here (never in a provider), because WordPress fires
 *     activation hooks without re-running plugins_loaded.
 *
 * Wrapped in an immediately-invoked closure so the bootstrap locals never enter
 * the global scope (WordPress.org Plugin Check flags global-scope plugin vars).
 */
(static function (): void {
    $autoload = __DIR__ . '/vendor/autoload.php';

    if (! is_file($autoload)) {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>';
            echo esc_html__(
                'FastCGI Cache for Ploi: dependencies are missing. Run "composer install" in the plugin directory.',
                'fastcgi-cache-for-ploi'
            );
            echo '</p></div>';
        });

        return;
    }

    require $autoload;

    $plugin = Plugin::create(__FILE__);

    // Always-on services: core bindings, REST routes, and the flush/event engine.
    $plugin->withProviders([
        CoreServiceProvider::class,
        RestServiceProvider::class,
        FlushServiceProvider::class,
    ]);

    // Admin settings screen — loads only in wp-admin.
    $plugin->withModule(new AdminUiModule([
        AdminServiceProvider::class,
    ]));

    // Activation/deactivation must be wired synchronously, before the
    // plugins_loaded deferral, because WordPress fires activation hooks without
    // re-running it.
    $plugin->withLifecycle(static function (Lifecycle $lifecycle) use ($plugin): void {
        $prefix = $plugin->optionPrefix();
        $lifecycle->onActivate(static fn () => Activator::activate($prefix));
        $lifecycle->onDeactivate(static fn () => Deactivator::deactivate());
    });

    add_action('plugins_loaded', static function () use ($plugin): void {
        $plugin->boot();
    });
})();
