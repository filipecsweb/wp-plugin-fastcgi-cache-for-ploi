<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Tests\Unit\Log;

use Brain\Monkey\Functions;
use FastCgiCacheForPloi\Log\FlushLogEntry;

beforeEach(function (): void {
    Functions\when('__')->returnArg(1);
});

it('maps 401, 404 and 422 to a tense-neutral gloss and returns null for everything else', function (): void {
    expect(FlushLogEntry::failureHint(401))
        ->toBe('Ploi rejected the token as wrong or expired.');
    expect(FlushLogEntry::failureHint(404))
        ->toBe('Ploi could not find the server or site — it may have been deleted.');
    expect(FlushLogEntry::failureHint(422))
        ->toBe('Ploi rejected the flush — FastCGI caching may not be enabled for this site.');

    foreach ([0, 200, 403, 500] as $code) {
        expect(FlushLogEntry::failureHint($code))->toBeNull();
    }
});

it('phrases the gloss as a diagnostic, never a stale time-stamp or instruction', function (): void {
    expect(FlushLogEntry::failureHint(401))->not->toContain('At the time');
    expect(FlushLogEntry::failureHint(404))->not->toContain('At the time');
    expect(FlushLogEntry::failureHint(422))->not->toContain('At the time');
});

it('serializes the hint from the same single source as failureHint()', function (): void {
    Functions\when('get_option')->returnArg(2);
    Functions\when('get_date_from_gmt')->returnArg(1);
    Functions\when('mysql2date')->returnArg(2);

    $failed = new FlushLogEntry(
        reason: 'manual',
        serverId: '1',
        siteId: '2',
        success: false,
        httpCode: 422,
        durationMs: 120,
        message: 'The given data was invalid.',
        id: 7,
        createdAt: '2026-01-01 00:00:00',
    );

    expect($failed->toArray()['hint'])->toBe(FlushLogEntry::failureHint(422));

    $succeeded = new FlushLogEntry(
        reason: 'manual',
        serverId: '1',
        siteId: '2',
        success: true,
        httpCode: 200,
        durationMs: 80,
        message: null,
        id: 8,
        createdAt: '2026-01-01 00:00:00',
    );

    expect($succeeded->toArray()['hint'])->toBeNull();
});
