<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation\Hooks;

use Attribute;

/**
 * @since 1.0.0
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
