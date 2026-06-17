<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Tests\Unit\Settings;

use Brain\Monkey\Functions;
use FastCgiCacheForPloi\Settings\PloiSettings;
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
        new Options('fastcgi_cache_for_ploi_settings', PloiSettings::defaults()),
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

it('normalises event toggles to the known keys', function (): void {
    $settings = ($this->make)();
    $settings->setEvents(['theme' => true, 'unknown' => true]);

    $events = $settings->events();
    expect($events)->toHaveKey('theme')
        ->and($events['theme'])->toBeTrue()
        ->and($events)->not->toHaveKey('unknown')
        ->and($settings->isEventEnabled('post_save'))->toBeFalse();
});

it('disconnect deletes the token + target, resets reconnect, and keeps events', function (): void {
    $settings = ($this->make)();
    $settings->setToken('secret-token');
    $settings->setTarget('7', '42', 'srv', 'site.test');
    $settings->setEvents(['post_save' => true, 'menu' => true]);

    $settings->disconnect();

    // hasStoredToken probes the raw option row, so it proves removal without decrypting.
    expect($settings->hasStoredToken())->toBeFalse()
        ->and($settings->token())->toBeNull()
        ->and($settings->hasToken())->toBeFalse()
        ->and(($this->make)()->hasStoredToken())->toBeFalse();

    // Clean empty state, not the decrypt-failure "needs reconnect" state.
    expect($settings->needsReconnect())->toBeFalse();

    // Target cleared (stale IDs could misfire).
    expect($settings->serverId())->toBe('')
        ->and($settings->serverName())->toBe('')
        ->and($settings->siteId())->toBe('')
        ->and($settings->siteDomain())->toBe('');

    expect($settings->isEventEnabled('post_save'))->toBeTrue()
        ->and($settings->isEventEnabled('menu'))->toBeTrue();

    expect($settings->toArray())
        ->toMatchArray([
            'hasToken'       => false,
            'needsReconnect' => false,
            'serverId'       => '',
            'siteId'         => '',
            'isConfigured'   => false,
        ]);
});

it('is configured only with token, server and site', function (): void {
    $settings = ($this->make)();
    expect($settings->isConfigured())->toBeFalse();

    $settings->setToken('t');
    $settings->setTarget('1', '2', 'srv', 'site.test');

    expect($settings->isConfigured())->toBeTrue()
        ->and($settings->isReadyForAutoFlush())->toBeTrue();
});
