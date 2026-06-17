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
                $this->config($page)
            );
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function config(SettingsPage $page): array
    {
        $nonce    = $this->container->make(Nonce::class);
        $settings = $this->container->make(PloiSettings::class);
        $log      = $this->container->make(FlushLogRepository::class);

        return [
            'restUrl'     => esc_url_raw(rest_url(RestServiceProvider::NAMESPACE)),
            'nonce'       => $nonce->create('wp_rest'),
            'tabs'        => $page->tabKeys(),
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
                'saved'          => __('Settings saved.', 'fastcgi-cache-for-ploi'),
                'connected'      => __('Connected to Ploi. Now choose a flush target.', 'fastcgi-cache-for-ploi'),
                'targetSaved'    => __('Flush target updated.', 'fastcgi-cache-for-ploi'),
                'disconnected'   => __('Token removed. Add a new token to reconnect.', 'fastcgi-cache-for-ploi'),
                'genericError'   => __('Something went wrong. Please try again.', 'fastcgi-cache-for-ploi'),
                'needToken'      => __('Add a Ploi API token first.', 'fastcgi-cache-for-ploi'),
                'needTarget'     => __('Choose a server and site.', 'fastcgi-cache-for-ploi'),
                'badDebounce'    => sprintf(
                    /* translators: 1: minimum seconds, 2: maximum seconds. */
                    __('Coalesce window must be a whole number between %1$d and %2$d seconds.', 'fastcgi-cache-for-ploi'),
                    PloiSettings::DEBOUNCE_MIN,
                    PloiSettings::DEBOUNCE_MAX
                ),
                // Reconnect-banner body, keyed by why the saved token is unusable.
                // Keys track ConnectionController's failure states + the decrypt
                // failure (409), funnelled through store requireReconnect().
                'reconnect'      => [
                    'unreadable'         => __('Your saved token could not be read — your site\'s security keys may have changed. Re-enter your Ploi API token and click Connect.', 'fastcgi-cache-for-ploi'),
                    'invalid'            => __('Ploi rejected your saved token. Re-enter a valid Ploi API token and click Connect.', 'fastcgi-cache-for-ploi'),
                    'missing_permission' => __('Your saved token is missing a required permission. Re-enter a token with the Servers and Sites scopes and click Connect.', 'fastcgi-cache-for-ploi'),
                ],
                // Transient reachability failure (network / unexpected Ploi error).
                'cannotReach'    => __('Couldn\'t reach Ploi right now. Try again in a moment.', 'fastcgi-cache-for-ploi'),
            ],
        ];
    }

    /**
     * Key falls back to DB-stored salts when no dedicated/wp-config constant is
     * set; see docs/security.md.
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
