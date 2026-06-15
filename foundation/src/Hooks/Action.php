<?php

declare(strict_types=1);

namespace WPForge\Hooks;

use Attribute;

/**
 * Declares that the target method should be registered with add_action().
 *
 * Repeatable, so one method can bind to several actions.
 */
#[Attribute(Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
final class Action
{
    public function __construct(
        public readonly string $hook,
        public readonly int $priority = 10,
        public readonly int $acceptedArgs = 1,
    ) {
    }
}
