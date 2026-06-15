<?php

declare(strict_types=1);

namespace WPForge\Provider;

use WPForge\Container\Container;
use WPForge\Contracts\ServiceProviderInterface;
use WPForge\Hooks\HookRegistrar;

/**
 * Base service provider.
 *
 * Subclasses bind services in register() and may attach hooks in boot().
 * Any class listed in $subscribers is resolved from the container during
 * boot() and scanned by the HookRegistrar for #[Action] / #[Filter]
 * attributes — this is how attribute-driven hooks get wired without manual
 * add_action() calls. Subclasses overriding boot() should call parent::boot().
 */
abstract class ServiceProvider implements ServiceProviderInterface
{
    /** @var list<class-string> */
    protected array $subscribers = [];

    public function __construct(protected readonly Container $container)
    {
    }

    public function register(): void
    {
    }

    public function boot(): void
    {
        if ($this->subscribers === []) {
            return;
        }

        $registrar = $this->container->make(HookRegistrar::class);

        foreach ($this->subscribers as $subscriber) {
            $instance = $this->container->make($subscriber);

            if (is_object($instance)) {
                $registrar->register($instance);
            }
        }
    }
}
