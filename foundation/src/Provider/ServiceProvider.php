<?php

declare(strict_types=1);

namespace WPForge\Provider;

use WPForge\Container\Container;
use WPForge\Contracts\ServiceProviderInterface;
use WPForge\Hooks\HookRegistrar;

/**
 * Subclasses overriding boot() MUST call parent::boot() or $subscribers'
 * attribute hooks won't wire.
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
