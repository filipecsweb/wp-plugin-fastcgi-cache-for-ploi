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
        $plugin   = $this->container->make(Plugin::class);
        $nonce    = $this->container->make(Nonce::class);
        $settings = $this->container->make(PloiSettings::class);
        $log      = $this->container->make(FlushLogRepository::class);

        return [
            'restUrl'     => esc_url_raw(rest_url(RestServiceProvider::NAMESPACE)),
            'nonce'       => $nonce->create('wp_rest'),
            'version'     => $plugin->version(),
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
                // Keys must track ConnectionController's state strings; one source
                // for both the badge and the after-Save notice. 'unknown' (Ploi
                // unreachable) stays neutral so a blip never reads as invalid.
                'connection'     => [
                    'absent'             => __('No token saved yet.', 'fastcgi-cache-for-ploi'),
                    'checking'           => __('Checking your token…', 'fastcgi-cache-for-ploi'),
                    'ok'                 => __('Connected.', 'fastcgi-cache-for-ploi'),
                    'invalid'            => __('Your saved token is no longer valid. Enter a new one and save.', 'fastcgi-cache-for-ploi'),
                    'missing_permission' => __(
                        'Your saved token is missing a required permission. Enter a token with the Servers and Sites scopes and save.',
                        'fastcgi-cache-for-ploi'
                    ),
                    'unknown'            => __('Couldn\'t verify your token right now.', 'fastcgi-cache-for-ploi'),
                ],
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
