<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Providers;

use FastCgiCacheForPloi\Cache\FlushScheduler;
use FastCgiCacheForPloi\Events\ContentChangeSubscriber;
use WPForge\Provider\ServiceProvider;

/**
 * Wires the content-change subscriber (its #[Action] hooks are registered by the
 * base provider via $subscribers) and the cron callback that runs the coalesced
 * flush.
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
