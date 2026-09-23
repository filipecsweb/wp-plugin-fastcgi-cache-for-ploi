<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Tests\Unit\Admin;

use Brain\Monkey\Functions;
use FastCgiCacheForPloi\Foundation\Assets\Vite;
use FastCgiCacheForPloi\Foundation\I18n\TextDomain;
use FastCgiCacheForPloi\Module\AdminUi\AdminAssets;

beforeEach(function (): void {
    $this->buildPath = sys_get_temp_dir() . '/admin-assets-test-' . uniqid();
    mkdir($this->buildPath . '/.vite', 0777, true);
    file_put_contents($this->buildPath . '/.vite/manifest.json', (string) json_encode([
        'resources/js/app.tsx' => ['file' => 'app.js', 'isEntry' => true],
    ]));

    $this->assets = new AdminAssets(new Vite($this->buildPath, 'https://example.test/build'));

    $this->translations = [];
    Functions\when('wp_enqueue_script')->justReturn();
    Functions\when('wp_set_script_translations')->alias(function (string ...$args): void {
        $this->translations[] = $args;
    });
});

afterEach(function (): void {
    unlink($this->buildPath . '/.vite/manifest.json');
    rmdir($this->buildPath . '/.vite');
    rmdir($this->buildPath);
});

it('registers the script translations from the text domain directory', function (): void {
    $this->assets->enqueueOnScreen(
        'settings_page_x',
        'settings_page_x',
        'resources/js/app.tsx',
        'plugin-app',
        textDomain: new TextDomain('fastcgi-cache-for-ploi', 'fastcgi-cache-for-ploi/languages'),
    );

    expect($this->translations)->toBe([
        ['plugin-app', 'fastcgi-cache-for-ploi', WP_PLUGIN_DIR . '/fastcgi-cache-for-ploi/languages'],
    ]);
});

it('registers no translations without a text domain', function (): void {
    $this->assets->enqueueOnScreen('settings_page_x', 'settings_page_x', 'resources/js/app.tsx', 'plugin-app');

    expect($this->translations)->toBe([]);
});
