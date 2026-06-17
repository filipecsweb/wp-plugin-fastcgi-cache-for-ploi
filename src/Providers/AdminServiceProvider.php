<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Providers;

use FastCgiCacheForPloi\Admin\SettingsPage;
use FastCgiCacheForPloi\Cache\FlushEvents;
use FastCgiCacheForPloi\Log\FlushLogEntry;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Settings\PloiSettings;
use WPForge\Assets\Vite;
use WPForge\Module\AdminUi\AdminAssets;
use WPForge\Plugin;
use WPForge\Provider\ServiceProvider;
use WPForge\Security\Nonce;

/**
 * Registers the Settings → FastCGI Cache for Ploi screen and enqueues its bundle,
 * hydrating the Alpine app with the real saved settings and recent flush log.
 */
final class AdminServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->container->singleton(SettingsPage::class, function (): SettingsPage {
            $plugin = $this->container->make(Plugin::class);

            return new SettingsPage(
                $plugin->dir() . 'resources/views/settings.php',
                $plugin->dir() . 'resources/views/partials/admin-footer.php',
                $plugin->name(),
                $plugin->version(),
            );
        });
    }

    public function boot(): void
    {
        $page = $this->container->make(SettingsPage::class);

        add_action('admin_menu', [$page, 'register']);

        add_action('admin_enqueue_scripts', function (string $hookSuffix) use ($page): void {
            $assets = new AdminAssets($this->container->make(Vite::class));

            $assets->enqueueOnScreen(
                $page->hookSuffix(),
                $hookSuffix,
                'resources/js/admin.js',
                'fastcgi-cache-for-ploi-admin',
                'PloiCacheConfig',
                $this->config()
            );
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function config(): array
    {
        $plugin   = $this->container->make(Plugin::class);
        $nonce    = $this->container->make(Nonce::class);
        $settings = $this->container->make(PloiSettings::class);
        $log      = $this->container->make(FlushLogRepository::class);

        return [
            'restUrl'     => esc_url_raw(rest_url(RestServiceProvider::NAMESPACE)),
            'nonce'       => $nonce->create('wp_rest'),
            'version'     => $plugin->version(),
            'events'      => FlushEvents::all(),
            'settings'    => $settings->toArray(),
            'log'         => array_map(
                static fn (FlushLogEntry $entry): array => $entry->toArray(),
                $log->recent(FlushLogRepository::RECENT_LIMIT)
            ),
            'keyWarning'      => $this->keyIsDatabaseDerived(),
            'debounceMin'     => PloiSettings::DEBOUNCE_MIN,
            'debounceMax'     => PloiSettings::DEBOUNCE_MAX,
            'debounceDefault' => PloiSettings::DEBOUNCE_DEFAULT,
            'i18n'        => [
                'connected'      => __('Connection successful.', 'fastcgi-cache-for-ploi'),
                'saved'          => __('Settings saved.', 'fastcgi-cache-for-ploi'),
                'disconnected'   => __('Token removed. Add a new token to reconnect.', 'fastcgi-cache-for-ploi'),
                'genericError'   => __('Something went wrong. Please try again.', 'fastcgi-cache-for-ploi'),
                'needToken'      => __('Add a Ploi API token first.', 'fastcgi-cache-for-ploi'),
                'needTarget'     => __('Choose a server and site, then save.', 'fastcgi-cache-for-ploi'),
                'reconnectShort' => __('Re-enter your token to reconnect.', 'fastcgi-cache-for-ploi'),
                'badDebounce'    => sprintf(
                    /* translators: 1: minimum seconds, 2: maximum seconds. */
                    __('Coalesce window must be a whole number between %1$d and %2$d seconds.', 'fastcgi-cache-for-ploi'),
                    PloiSettings::DEBOUNCE_MIN,
                    PloiSettings::DEBOUNCE_MAX
                ),
            ],
        ];
    }

    /**
     * True when the encryption key falls back to DB-stored salts (no dedicated
     * constant and no wp-config salt constants) — see docs/security.md.
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
