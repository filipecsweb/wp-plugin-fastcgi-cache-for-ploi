<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Module\AdminUi;

use FastCgiCacheForPloi\Foundation\Container\Container;
use FastCgiCacheForPloi\Foundation\Contracts\ModuleInterface;
use FastCgiCacheForPloi\Foundation\Contracts\ServiceProviderInterface;

/**
 * Gated to is_admin() so menu/asset work never runs on front-end requests.
 *
 * @since 1.0.0
 */
final class AdminUiModule implements ModuleInterface
{
    /**
     * @since 1.0.0
     *
     * @param list<class-string<ServiceProviderInterface>> $providers
     */
    public function __construct(private readonly array $providers)
    {
    }

    /**
     * @since 1.0.0
     */
    public function name(): string
    {
        return 'admin-ui';
    }

    /**
     * @since 1.0.0
     */
    public function providers(): array
    {
        return $this->providers;
    }

    /**
     * @since 1.0.0
     */
    public function isEnabled(Container $container): bool
    {
        return is_admin();
    }
}
