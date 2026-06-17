<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Admin;

use FastCgiCacheForPloi\Providers\RestServiceProvider;
use WPForge\Module\AdminUi\AdminPage;

/**
 * The "Settings → FastCGI Cache for Ploi" screen.
 *
 * Placed as a submenu under Settings by returning a parent slug;
 * returning null instead would make the very same class a top-level menu.
 */
final class SettingsPage extends AdminPage
{
    public const SLUG = 'fastcgi-cache-for-ploi';

    /**
     * Tab keys. Single source of truth for the screen's two tabs — the view
     * renders the nav + panels from these, the Alpine store keys its panels off
     * them, and the URL hash uses them (#settings / #logs).
     */
    public const TAB_SETTINGS = 'settings';
    public const TAB_LOGS     = 'logs';

    public function __construct(
        private readonly string $viewPath,
        private readonly string $footerPath,
        private readonly string $pluginName,
        private readonly string $version,
    ) {
    }

    protected function slug(): string
    {
        return self::SLUG;
    }

    protected function parentSlug(): string
    {
        return 'options-general.php';
    }

    /**
     * Gate the screen with the same capability the REST routes enforce, from the
     * one shared definition.
     */
    protected function capability(): string
    {
        return RestServiceProvider::CAPABILITY;
    }

    protected function pageTitle(): string
    {
        return __('FastCGI Cache for Ploi', 'fastcgi-cache-for-ploi');
    }

    protected function menuTitle(): string
    {
        return __('FastCGI Cache', 'fastcgi-cache-for-ploi');
    }

    /**
     * The screen's tabs (key + translated label), in display order. Read by the
     * view to render the nav bar and by AdminServiceProvider::config() to expose
     * the valid keys to the Alpine hash guard. Safe to translate here — the page
     * only renders / enqueues well after the `init` hook.
     *
     * @return list<array{key: string, label: string}>
     */
    public function tabs(): array
    {
        return [
            ['key' => self::TAB_SETTINGS, 'label' => __('Settings', 'fastcgi-cache-for-ploi')],
            ['key' => self::TAB_LOGS, 'label' => __('Logs', 'fastcgi-cache-for-ploi')],
        ];
    }

    /**
     * Just the tab keys, for the client-side URL-hash guard.
     *
     * @return list<string>
     */
    public function tabKeys(): array
    {
        return array_column($this->tabs(), 'key');
    }

    protected function renderBody(): void
    {
        require $this->viewPath;
    }

    /**
     * Render a view partial from resources/views/partials/, executed in this
     * page's scope (like renderFooter()) so it can call $this->* helpers and read
     * the tab constants. $data keys become local variables in the partial. $name
     * is always a trusted internal literal (never user input).
     *
     * @param array<string, mixed> $data
     */
    protected function partial(string $name, array $data = []): void
    {
        extract($data, EXTR_OVERWRITE);
        require dirname($this->viewPath) . '/partials/' . $name . '.php';
    }

    /**
     * Render the shared admin footer. Called from the page views so the partial
     * executes in this object's scope and renders consistently across screens.
     */
    public function renderFooter(): void
    {
        require $this->footerPath;
    }

    /**
     * Plugin display name shown in the footer.
     */
    protected function footerName(): string
    {
        return $this->pluginName;
    }

    /**
     * Plugin version shown in the footer.
     */
    protected function footerVersion(): string
    {
        return $this->version;
    }
}
