<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Tests\Unit\Cache;

use Brain\Monkey\Functions;
use Ploi\FastCgiCache\Cache\FlushEvents;
use Ploi\FastCgiCache\Cache\FlushReason;

beforeEach(function (): void {
    Functions\when('__')->returnArg(1);
});

it('maps each auto reason to a FlushEvents toggle key', function (): void {
    $keys = FlushEvents::keys();

    foreach ([FlushReason::PostSave, FlushReason::PostDelete, FlushReason::Comment, FlushReason::Theme, FlushReason::Customizer, FlushReason::Menu] as $reason) {
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
