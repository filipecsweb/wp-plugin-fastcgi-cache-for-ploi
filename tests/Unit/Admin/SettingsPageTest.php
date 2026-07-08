<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Tests\Unit\Admin;

use Brain\Monkey\Functions;
use FastCgiCacheForPloi\Admin\SettingsPage;

beforeEach(function (): void {
    Functions\when('__')->returnArg(1);
    Functions\when('esc_html__')->returnArg(1);
    Functions\when('esc_url')->returnArg(1);
    Functions\when('add_query_arg')->alias(
        fn (string $key, string $value, string $url): string => $url . '?' . $key . '=' . $value
    );
    Functions\when('admin_url')->alias(fn (string $path): string => 'https://example.test/wp-admin/' . $path);

    $this->page = new SettingsPage('view.php', 'footer.php', 'FastCGI Cache for Ploi', '1.0.0');
});

it('prepends a Settings link pointing at the settings page', function (): void {
    $actions = $this->page->pluginActionLinks(['deactivate' => '<a href="#">Deactivate</a>']);

    expect(array_keys($actions))->toBe(['settings', 'deactivate'])
        ->and($actions['settings'])->toContain('https://example.test/wp-admin/options-general.php?page=' . SettingsPage::SLUG)
        ->and($actions['settings'])->toContain('>Settings</a>');
});
