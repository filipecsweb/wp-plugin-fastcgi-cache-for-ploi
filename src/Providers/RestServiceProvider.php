<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Providers;

use Ploi\FastCgiCache\Cache\CacheFlusher;
use Ploi\FastCgiCache\Log\FlushLogRepository;
use Ploi\FastCgiCache\Ploi\PloiClient;
use Ploi\FastCgiCache\Rest\ConnectionController;
use Ploi\FastCgiCache\Rest\FlushController;
use Ploi\FastCgiCache\Rest\LogController;
use Ploi\FastCgiCache\Rest\SettingsController;
use Ploi\FastCgiCache\Settings\PloiSettings;
use WPForge\Provider\ServiceProvider;
use WPForge\Security\Capability;

/**
 * Registers the REST controllers (all extend the Foundation RestController and
 * enforce nonce + capability via guard()). The base controller takes the REST
 * namespace as a constructor string, so each controller is bound explicitly.
 */
final class RestServiceProvider extends ServiceProvider
{
    public const NAMESPACE = 'ploi-fastcgi-cache/v1';

    /** @var list<class-string<\WPForge\Rest\RestController>> */
    private const CONTROLLERS = [
        ConnectionController::class,
        SettingsController::class,
        FlushController::class,
        LogController::class,
    ];

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

    public function boot(): void
    {
        foreach (self::CONTROLLERS as $controller) {
            $this->container->make($controller)->hook();
        }
    }
}
