<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Tests\Unit\Rest;

use Brain\Monkey\Functions;
use Ploi\FastCgiCache\Log\FlushLogEntry;
use Ploi\FastCgiCache\Rest\FlushController;
use ReflectionClass;
use ReflectionMethod;

beforeEach(function (): void {
    Functions\when('__')->returnArg(1);
});

/**
 * failureNotice() is private and touches no instance state, so we drive it directly
 * via reflection on a constructor-less instance. The point of these tests is the seam
 * the change is about: the immediate "Flush now" banner must derive its wording from
 * the single-source FlushLogEntry::failureHint(), never from an inline copy.
 */
function invokeFailureNotice(int $httpCode, ?string $raw): string
{
    $controller = (new ReflectionClass(FlushController::class))->newInstanceWithoutConstructor();
    $method     = new ReflectionMethod(FlushController::class, 'failureNotice');
    $method->setAccessible(true);

    return $method->invoke($controller, $httpCode, $raw);
}

it('composes the banner from the single-source hint plus the raw Ploi message', function (): void {
    $notice = invokeFailureNotice(422, 'The given data was invalid.');

    expect($notice)
        ->toContain(FlushLogEntry::failureHint(422)) // pulled from the shared source
        ->toContain('The given data was invalid.')   // raw Ploi message still appended
        ->not->toContain('At the time');             // proves the reworded source is what renders
});

it('shows the bare hint when Ploi returns no raw message', function (): void {
    expect(invokeFailureNotice(401, null))->toBe(FlushLogEntry::failureHint(401));
    expect(invokeFailureNotice(401, ''))->toBe(FlushLogEntry::failureHint(401));
});

it('falls back to the raw message, then a generic notice, for a status with no gloss', function (): void {
    expect(FlushLogEntry::failureHint(500))->toBeNull();
    expect(invokeFailureNotice(500, 'Server error'))->toBe('Server error');
    expect(invokeFailureNotice(500, null))->toBe('The flush request failed.');
});
