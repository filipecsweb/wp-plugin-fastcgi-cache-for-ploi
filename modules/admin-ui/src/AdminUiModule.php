<?php

declare(strict_types=1);

namespace WPForge\Module\AdminUi;

use WPForge\Container\Container;
use WPForge\Contracts\ModuleInterface;
use WPForge\Contracts\ServiceProviderInterface;

/**
 * Gated to is_admin() so menu/asset work never runs on front-end requests.
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
