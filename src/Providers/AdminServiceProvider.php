<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Providers;

use FastCgiCacheForPloi\Admin\SettingsPage;
use FastCgiCacheForPloi\Cache\FlushEvents;
use FastCgiCacheForPloi\Log\FlushLogEntry;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Settings\PloiSettings;
use FastCgiCacheForPloi\Foundation\Assets\Vite;
use FastCgiCacheForPloi\Foundation\I18n\TextDomain;
use FastCgiCacheForPloi\Module\AdminUi\AdminAssets;
use FastCgiCacheForPloi\Foundation\Plugin;
use FastCgiCacheForPloi\Foundation\Provider\ServiceProvider;

/**
 * @since 1.0.0
 */
final class AdminServiceProvider extends ServiceProvider
{
    /**
     * @since 1.1.0 The page takes no view paths any more.
     * @since 1.0.0
     */
    public function register(): void
    {
        $this->container->singleton(SettingsPage::class);
    }

    /**
     * @since 1.1.0 Enqueues the React entry with its core-script dependencies and translations.
     * @since 1.0.1 Also registers the plugin_action_links filter that adds the
     *     Settings-row link (hook name embeds the runtime basename, so it can't
     *     be a compile-time #[Filter]).
     * @since 1.0.0
     */
    public function boot(): void
    {
        $page   = $this->container->make(SettingsPage::class);
        $plugin = $this->container->make(Plugin::class);

        add_action('admin_menu', [$page, 'register']);

        // WHY manual: the hook name embeds the runtime plugin basename, which a
        // compile-time #[Filter] attribute can't express.
        add_filter('plugin_action_links_' . $plugin->basename(), [$page, 'pluginActionLinks']);

        add_action('admin_enqueue_scripts', function (string $hookSuffix) use ($page): void {
            $assets = new AdminAssets($this->container->make(Vite::class));

            $assets->enqueueOnScreen(
                $page->hookSuffix(),
                $hookSuffix,
                'resources/js/app/main.tsx',
                'fastcgi-cache-for-ploi-app',
                'PloiCacheConfig',
                $this->config(),
                $this->container->make(TextDomain::class)
            );
        });
    }

    /**
     * CONTRACT: the keys are the Config type in resources/js/app/store.ts; keep the
     * two in step.
     *
     * @since 1.1.0 Carries only what the React screen reads: restNamespace and plugin
     *     (name + version) added; restUrl, nonce, tabs and i18n dropped, since core's
     *     apiFetch and the script translations cover them.
     * @since 1.0.0
     *
     * @return array<string, mixed>
     */
    private function config(): array
    {
        $settings = $this->container->make(PloiSettings::class);
        $log      = $this->container->make(FlushLogRepository::class);
        $plugin   = $this->container->make(Plugin::class);

        return [
            'restNamespace' => RestServiceProvider::NAMESPACE,
            'plugin'        => ['name' => $plugin->name(), 'version' => $plugin->version()],
            'events'        => FlushEvents::all(),
            'settings'      => $settings->toArray(),
            'log'           => array_map(
                static fn (FlushLogEntry $entry): array => $entry->toArray(),
                $log->recent(FlushLogRepository::RECENT_LIMIT)
            ),
            'keyWarning'    => $this->keyIsDatabaseDerived(),
        ];
    }

    /**
     * True ONLY when the stored token is genuinely DB-decryptable: no dedicated
     * FASTCGI_CACHE_FOR_PLOI_KEY AND the WP salts Crypto falls back to are not pinned
     * in wp-config.php (undefined or left as the shipped placeholder), so wp_salt()
     * sources them from the database. Mirrors WordPress's own wp_salt() fallback, so
     * the warning flags only the at-risk install — a standard install with real salts
     * is safe and sees nothing.
     *
     * @since 1.0.0
     */
    private function keyIsDatabaseDerived(): bool
    {
        $keyConstant = CoreServiceProvider::KEY_CONSTANT;

        if (defined($keyConstant) && constant($keyConstant)) {
            return false;
        }

        foreach (['AUTH_KEY', 'SECURE_AUTH_KEY'] as $constant) {
            $value = defined($constant) ? constant($constant) : '';

            if (! is_string($value) || $value === '' || str_contains($value, 'put your unique phrase here')) {
                return true;
            }
        }

        return false;
    }
}
