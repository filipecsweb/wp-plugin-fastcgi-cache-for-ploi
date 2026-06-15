<?php

declare(strict_types=1);

namespace WPForge\Module\AdminUi;

use WPForge\Container\Container;
use WPForge\Contracts\ModuleInterface;
use WPForge\Contracts\ServiceProviderInterface;

/**
 * The admin-ui module.
 *
 * Ships the reusable AdminPage / AdminAssets machinery and declares the
 * service providers that build admin screens. Loads only in the admin context,
 * so its menu/asset work never runs on front-end requests.
 */
final class AdminUiModule implements ModuleInterface
{
    /**
     * @param list<class-string<ServiceProviderInterface>> $providers
     */
    public function __construct(private readonly array $providers)
    {
    }

    public function name(): string
    {
        return 'admin-ui';
    }

    public function providers(): array
    {
        return $this->providers;
    }

    public function isEnabled(Container $container): bool
    {
        return is_admin();
    }
}
