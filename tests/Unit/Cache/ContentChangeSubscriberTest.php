<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Tests\Unit\Cache;

use Brain\Monkey\Functions;
use FastCgiCacheForPloi\Cache\CacheFlusher;
use FastCgiCacheForPloi\Cache\FlushScheduler;
use FastCgiCacheForPloi\Events\ContentChangeSubscriber;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Ploi\PloiClient;
use FastCgiCacheForPloi\Settings\PloiSettings;
use FastCgiCacheForPloi\Foundation\Http\HttpClient;
use FastCgiCacheForPloi\Foundation\Logging\Logger;
use FastCgiCacheForPloi\Foundation\Security\Crypto;
use FastCgiCacheForPloi\Foundation\Settings\Options;

if (! defined('MINUTE_IN_SECONDS')) {
    define('MINUTE_IN_SECONDS', 60);
}

/**
 * Build a real (un-mockable, final) CacheFlusher. schedule() never calls it, so
 * its collaborators only need to construct, not run.
 */
function ccs_make_settings(): PloiSettings
{
    return new PloiSettings(
        new Options('fastcgi_cache_for_ploi_settings', PloiSettings::defaults()),
        new Crypto(str_repeat('a', SODIUM_CRYPTO_SECRETBOX_KEYBYTES))
    );
}

function ccs_make_scheduler(PloiSettings $settings): FlushScheduler
{
    $flusher = new CacheFlusher($settings, new PloiClient(new HttpClient()), new FlushLogRepository(), new Logger('test'));

    return new FlushScheduler($flusher);
}

beforeEach(function (): void {
    $this->store      = [];
    $this->transients = [];
    $GLOBALS['cron_scheduled'] = [];
    $GLOBALS['wpdb'] = new class () {
        public string $prefix = 'wp_';
    };

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
    Functions\when('get_transient')->alias(fn ($key) => $this->transients[$key] ?? false);
    Functions\when('set_transient')->alias(function ($key, $value) {
        $this->transients[$key] = $value;
        return true;
    });
    Functions\when('wp_next_scheduled')->justReturn(false);
    Functions\when('wp_schedule_single_event')->alias(function ($timestamp, $hook): bool {
        $GLOBALS['cron_scheduled'][] = $hook;
        return true;
    });
});

it('schedules a flush when the event is enabled and the target is ready', function (): void {
    $settings = ccs_make_settings();
    $settings->setToken('token');
    $settings->setTarget('1', '2', 'srv', 'site.test');
    $settings->setEvents(['theme' => true]);

    (new ContentChangeSubscriber($settings, ccs_make_scheduler($settings)))->onSwitchTheme();

    expect($GLOBALS['cron_scheduled'])->toContain(FlushScheduler::CRON_HOOK);
});

it('does not schedule when the toggle is off (gated)', function (): void {
    $settings = ccs_make_settings();
    $settings->setToken('token');
    $settings->setTarget('1', '2', 'srv', 'site.test');
    $settings->setEvents(['theme' => false]);

    (new ContentChangeSubscriber($settings, ccs_make_scheduler($settings)))->onSwitchTheme();

    expect($GLOBALS['cron_scheduled'])->toBeEmpty();
});

it('does not schedule (silent no-op) when no target is configured', function (): void {
    $settings = ccs_make_settings();
    $settings->setEvents(['theme' => true]);

    (new ContentChangeSubscriber($settings, ccs_make_scheduler($settings)))->onSwitchTheme();

    expect($GLOBALS['cron_scheduled'])->toBeEmpty();
});
