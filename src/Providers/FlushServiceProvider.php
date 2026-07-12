<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Providers;

use FastCgiCacheForPloi\Cache\FlushScheduler;
use FastCgiCacheForPloi\Events\ContentChangeSubscriber;
use FastCgiCacheForPloi\Foundation\Provider\ServiceProvider;

/**
 * Cron callback can't be an #[Action], so it's wired manually here unlike the
 * $subscribers hooks.
 *
 * @since 1.0.0
 */
final class FlushServiceProvider extends ServiceProvider
{
    /** @var list<class-string> */
    protected array $subscribers = [ContentChangeSubscriber::class];

    public function boot(): void
    {
        parent::boot();

        $scheduler = $this->container->make(FlushScheduler::class);
        add_action(FlushScheduler::CRON_HOOK, [$scheduler, 'runScheduled']);
    }
}
