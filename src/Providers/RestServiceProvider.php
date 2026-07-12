<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Providers;

use FastCgiCacheForPloi\Cache\CacheFlusher;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Ploi\PloiClient;
use FastCgiCacheForPloi\Rest\ConnectionController;
use FastCgiCacheForPloi\Rest\FlushController;
use FastCgiCacheForPloi\Rest\LogController;
use FastCgiCacheForPloi\Rest\SettingsController;
use FastCgiCacheForPloi\Settings\PloiSettings;
use FastCgiCacheForPloi\Foundation\Provider\ServiceProvider;
use FastCgiCacheForPloi\Foundation\Security\Capability;
use FastCgiCacheForPloi\Foundation\Security\Sanitizer;

/**
 * Controllers take the REST namespace as a constructor string, so each is bound
 * explicitly (no autowire).
 *
 * @since 1.0.0
 */
final class RestServiceProvider extends ServiceProvider
{
    /**
     * @since 1.0.0
     */
    public const NAMESPACE = 'fastcgi-cache-for-ploi/v1';

    /**
     * The capability required to manage this plugin. Single source for every REST
     * guard AND the admin settings screen (SettingsPage::capability()), so the
     * access policy lives in exactly one place.
     *
     * @since 1.0.0
     */
    public const CAPABILITY = 'manage_options';

    /**
     * @since 1.0.0
     *
     * @var list<class-string<\FastCgiCacheForPloi\Foundation\Rest\RestController>>
     */
    private const CONTROLLERS = [
        ConnectionController::class,
        SettingsController::class,
        FlushController::class,
        LogController::class,
    ];

    /**
     * @since 1.0.0
     */
    public function register(): void
    {
        $container = $this->container;

        $container->singleton(ConnectionController::class, static fn () => new ConnectionController(
            self::NAMESPACE,
            $container->make(Capability::class),
            $container->make(PloiSettings::class),
            $container->make(PloiClient::class),
        ));

        $container->singleton(SettingsController::class, static fn () => new SettingsController(
            self::NAMESPACE,
            $container->make(Capability::class),
            $container->make(PloiSettings::class),
            $container->make(Sanitizer::class),
        ));

        $container->singleton(FlushController::class, static fn () => new FlushController(
            self::NAMESPACE,
            $container->make(Capability::class),
            $container->make(PloiSettings::class),
            $container->make(CacheFlusher::class),
        ));

        $container->singleton(LogController::class, static fn () => new LogController(
            self::NAMESPACE,
            $container->make(Capability::class),
            $container->make(FlushLogRepository::class),
        ));
    }

    /**
     * @since 1.0.0
     */
    public function boot(): void
    {
        foreach (self::CONTROLLERS as $controller) {
            $this->container->make($controller)->hook();
        }
    }
}
