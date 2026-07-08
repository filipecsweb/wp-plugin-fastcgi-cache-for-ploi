<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Providers;

use FastCgiCacheForPloi\Admin\SettingsPage;
use FastCgiCacheForPloi\Cache\FlushEvents;
use FastCgiCacheForPloi\Log\FlushLogEntry;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Settings\PloiSettings;
use FastCgiCacheForPloi\Foundation\Assets\Vite;
use FastCgiCacheForPloi\Module\AdminUi\AdminAssets;
use FastCgiCacheForPloi\Foundation\Plugin;
use FastCgiCacheForPloi\Foundation\Provider\ServiceProvider;
use FastCgiCacheForPloi\Foundation\Security\Nonce;

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
            'i18n'        => [
                'saved'          => __('Settings saved.', 'fastcgi-cache-for-ploi'),
                'connected'      => __('Connected to Ploi. Now choose a flush target.', 'fastcgi-cache-for-ploi'),
                'targetSaved'    => __('Flush target updated.', 'fastcgi-cache-for-ploi'),
                'disconnected'   => __('Token removed. Add a new token to reconnect.', 'fastcgi-cache-for-ploi'),
                'genericError'   => __('Something went wrong. Please try again.', 'fastcgi-cache-for-ploi'),
                'needToken'      => __('Add a Ploi API token first.', 'fastcgi-cache-for-ploi'),
                // Reconnect-banner body, keyed by why the saved token is unusable.
                // Keys track ConnectionController's failure states + the decrypt
                // failure (409), funnelled through store requireReconnect().
                'reconnect'      => [
                    'unreadable'         => __(
                        'Your saved token could not be read — your site\'s security keys may have changed. Re-enter your Ploi API token and click Connect.',
                        'fastcgi-cache-for-ploi'
                    ),
                    'invalid'            => __('Ploi rejected your saved token. Re-enter a valid Ploi API token and click Connect.', 'fastcgi-cache-for-ploi'),
                    'missing_permission' => __(
                        'Your saved token is missing a required permission. Re-enter a token with the Servers and Sites scopes and click Connect.',
                        'fastcgi-cache-for-ploi'
                    ),
                ],
                // Transient reachability failure (network / unexpected Ploi error).
                'cannotReach'    => __('Couldn\'t reach Ploi right now. Try again in a moment.', 'fastcgi-cache-for-ploi'),
                // Shown in the change-target modal when the saved server/site is no
                // longer in Ploi's live list, so the user knows why the picker reset.
                'targetGone'     => [
                    'server' => __('The saved server no longer exists in Ploi. Choose a new server and site.', 'fastcgi-cache-for-ploi'),
                    'site'   => __('The saved site no longer exists in Ploi. Choose another site.', 'fastcgi-cache-for-ploi'),
                ],
            ],
        ];
    }

    /**
     * True ONLY when the stored token is genuinely DB-decryptable: no dedicated
     * FASTCGI_CACHE_FOR_PLOI_KEY AND the WP salts Crypto falls back to are not pinned
     * in wp-config.php (undefined or left as the shipped placeholder), so wp_salt()
     * sources them from the database. Mirrors WordPress's own wp_salt() fallback, so
     * the warning flags only the at-risk install — a standard install with real salts
     * is safe and sees nothing.
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
