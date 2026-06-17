<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Tests\Unit\Cache;

use Brain\Monkey\Functions;
use FastCgiCacheForPloi\Cache\FlushEvents;
use FastCgiCacheForPloi\Cache\FlushReason;

beforeEach(function (): void {
    Functions\when('__')->returnArg(1);
});

it('exposes the six auto cases as the event keys and excludes Manual', function (): void {
    // FlushEvents::keys() now DERIVES from FlushReason::autoCases(), so this pins
    // the invariants that survive the single-source refactor: six auto events,
    // Manual is never a toggle key, and every auto case maps to a key.
    expect(FlushReason::autoCases())->toHaveCount(6);

    $keys = FlushEvents::keys();

    expect($keys)
        ->toHaveCount(6)
        ->not->toContain(FlushReason::Manual->value);

    foreach (FlushReason::autoCases() as $reason) {
        expect($keys)->toContain($reason->value);
    }
});

it('has labels for every reason', function (): void {
    foreach (FlushReason::cases() as $reason) {
        expect($reason->label())->not->toBe('');
    }
});

it('returns null for an unknown reason value', function (): void {
    expect(FlushReason::tryFrom('nope'))->toBeNull();
});

it('defaults all six events enabled', function (): void {
    expect(FlushEvents::defaults())->toHaveCount(6)
        ->and(array_values(FlushEvents::defaults()))->each->toBeTrue();
});
