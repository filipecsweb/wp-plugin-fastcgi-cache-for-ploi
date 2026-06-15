<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Providers;

use Ploi\FastCgiCache\Cache\CacheFlusher;
use Ploi\FastCgiCache\Cache\FlushScheduler;
use Ploi\FastCgiCache\Log\FlushLogRepository;
use Ploi\FastCgiCache\Ploi\PloiClient;
use Ploi\FastCgiCache\Settings\PloiSettings;
use WPForge\Database\Migrator;
use WPForge\Plugin;
use WPForge\Provider\ServiceProvider;
use WPForge\Security\Crypto;
use WPForge\Settings\Options;

/**
 * Binds the always-on plugin services into the container.
 *
 * Notably re-binds the Foundation's Crypto to source its key from a dedicated
 * wp-config constant when available (keeping it off the database and independent
 * of login-salt rotation — see docs/security.md), falling back to wp_salt().
 */
final class CoreServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $container = $this->container;
        $prefix    = $container->make(Plugin::class)->optionPrefix();

        $container->singleton(
            Options::class,
            static fn (): Options => new Options($prefix . '_settings', PloiSettings::defaults())
        );

        $container->singleton(Crypto::class, static function (): Crypto {
            if (defined('PLOI_FASTCGI_CACHE_KEY') && is_string(PLOI_FASTCGI_CACHE_KEY) && PLOI_FASTCGI_CACHE_KEY !== '') {
                return new Crypto(
                    sodium_crypto_generichash((string) PLOI_FASTCGI_CACHE_KEY, '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES)
                );
            }

            return new Crypto();
        });

        $container->singleton(
            Migrator::class,
            static fn (): Migrator => new Migrator($prefix . '_migrations')
        );

        // Autowired from the bindings above + Foundation primitives.
        $container->singleton(PloiSettings::class);
        $container->singleton(PloiClient::class);
        $container->singleton(FlushLogRepository::class);
        $container->singleton(CacheFlusher::class);
        $container->singleton(FlushScheduler::class);
    }
}
