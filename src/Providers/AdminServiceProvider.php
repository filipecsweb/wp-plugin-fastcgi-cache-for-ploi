<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Providers;

use Ploi\FastCgiCache\Admin\SettingsPage;
use Ploi\FastCgiCache\Cache\FlushEvents;
use Ploi\FastCgiCache\Log\FlushLogEntry;
use Ploi\FastCgiCache\Log\FlushLogRepository;
use Ploi\FastCgiCache\Settings\PloiSettings;
use WPForge\Assets\Vite;
use WPForge\Module\AdminUi\AdminAssets;
use WPForge\Plugin;
use WPForge\Provider\ServiceProvider;
use WPForge\Security\Nonce;

/**
 * Registers the Settings → Ploi FastCGI Cache screen and enqueues its bundle,
 * hydrating the Alpine app with the real saved settings and recent flush log.
 */
final class AdminServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->container->singleton(SettingsPage::class, function (): SettingsPage {
            $plugin = $this->container->make(Plugin::class);

            return new SettingsPage($plugin->dir() . 'resources/views/settings.php');
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
                'ploi-fastcgi-cache-admin',
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
                $log->recent(20)
            ),
            'keyWarning'  => $this->keyIsDatabaseDerived(),
            'debounceMin' => PloiSettings::DEBOUNCE_MIN,
            'debounceMax' => PloiSettings::DEBOUNCE_MAX,
            'i18n'        => [
                'connected'      => __('Connection successful.', 'ploi-fastcgi-cache'),
                'saved'          => __('Settings saved.', 'ploi-fastcgi-cache'),
                'flushed'        => __('FastCGI cache flushed.', 'ploi-fastcgi-cache'),
                'disconnected'   => __('Token removed. Add a new token to reconnect.', 'ploi-fastcgi-cache'),
                'genericError'   => __('Something went wrong. Please try again.', 'ploi-fastcgi-cache'),
                'needToken'      => __('Add a Ploi API token first.', 'ploi-fastcgi-cache'),
                'needTarget'     => __('Choose a server and site, then save.', 'ploi-fastcgi-cache'),
                'reconnectShort' => __('Re-enter your token to reconnect.', 'ploi-fastcgi-cache'),
                'badDebounce'    => sprintf(
                    /* translators: 1: minimum seconds, 2: maximum seconds. */
                    __('Coalesce window must be a whole number between %1$d and %2$d seconds.', 'ploi-fastcgi-cache'),
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
        if (defined('PLOI_FASTCGI_CACHE_KEY') && PLOI_FASTCGI_CACHE_KEY) {
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
