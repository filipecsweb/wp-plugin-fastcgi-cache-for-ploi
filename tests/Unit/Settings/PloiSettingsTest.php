<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Tests\Unit\Settings;

use Brain\Monkey\Functions;
use Ploi\FastCgiCache\Settings\PloiSettings;
use WPForge\Security\Crypto;
use WPForge\Settings\Options;

beforeEach(function (): void {
    $this->store = [];
    Functions\when('get_option')->alias(fn ($key, $default = false) => $this->store[$key] ?? $default);
    Functions\when('update_option')->alias(function ($key, $value) {
        $this->store[$key] = $value;
        return true;
    });
    Functions\when('delete_option')->alias(function ($key) {
        unset($this->store[$key]);
        return true;
    });
    Functions\when('__')->returnArg(1);

    $this->key = str_repeat('a', SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
    $this->make = fn (?string $key = null): PloiSettings => new PloiSettings(
        new Options('ploi_fastcgi_cache_settings', PloiSettings::defaults()),
        new Crypto($key ?? $this->key)
    );
});

it('encrypts then round-trips the token across instances', function (): void {
    ($this->make)()->setToken('secret-token');

    $fresh = ($this->make)();
    expect($fresh->token())->toBe('secret-token')
        ->and($fresh->hasToken())->toBeTrue();
});

it('clears the token and flags reconnect when decryption fails', function (): void {
    ($this->make)()->setToken('secret-token');

    $rotated = ($this->make)(str_repeat('b', SODIUM_CRYPTO_SECRETBOX_KEYBYTES));

    expect($rotated->token())->toBeNull()
        ->and($rotated->needsReconnect())->toBeTrue()
        ->and($rotated->hasStoredToken())->toBeFalse();
});

it('clamps the debounce window to 0..60', function (): void {
    $settings = ($this->make)();

    $settings->setDebounce(999);
    expect($settings->debounce())->toBe(60);

    $settings->setDebounce(-5);
    expect($settings->debounce())->toBe(0);
});

it('normalises event toggles to the known keys', function (): void {
    $settings = ($this->make)();
    $settings->setEvents(['theme' => true, 'unknown' => true]);

    $events = $settings->events();
    expect($events)->toHaveKey('theme')
        ->and($events['theme'])->toBeTrue()
        ->and($events)->not->toHaveKey('unknown')
        ->and($settings->isEventEnabled('post_save'))->toBeFalse();
});

it('is configured only with token, server and site', function (): void {
    $settings = ($this->make)();
    expect($settings->isConfigured())->toBeFalse();

    $settings->setToken('t');
    $settings->setTarget('1', '2', 'srv', 'site.test');

    expect($settings->isConfigured())->toBeTrue()
        ->and($settings->isReadyForAutoFlush())->toBeTrue();
});
