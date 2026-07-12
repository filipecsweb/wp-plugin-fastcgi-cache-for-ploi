<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Admin;

use FastCgiCacheForPloi\Providers\RestServiceProvider;
use FastCgiCacheForPloi\Module\AdminUi\AdminPage;

/**
 * @since 1.0.0
 */
final class SettingsPage extends AdminPage
{
    /**
     * @since 1.0.0
     */
    public const SLUG = 'fastcgi-cache-for-ploi';

    /**
     * Tab keys. Single source of truth for the screen's two tabs — the view
     * renders the nav + panels from these, the Alpine store keys its panels off
     * them, and the URL hash uses them (#settings / #logs).
     *
     * @since 1.0.0
     */
    public const TAB_SETTINGS = 'settings';
    /**
     * @since 1.0.0
     */
    public const TAB_LOGS     = 'logs';

    /**
     * @since 1.0.0
     */
    public function __construct(
        private readonly string $viewPath,
        private readonly string $footerPath,
        private readonly string $pluginName,
        private readonly string $version,
    ) {
    }

    /**
     * @since 1.0.0
     */
    protected function slug(): string
    {
        return self::SLUG;
    }

    /**
     * @since 1.0.0
     */
    protected function parentSlug(): string
    {
        return 'options-general.php';
    }

    /**
     * Gate the screen with the same capability the REST routes enforce, from the
     * one shared definition.
     *
     * @since 1.0.0
     */
    protected function capability(): string
    {
        return RestServiceProvider::CAPABILITY;
    }

    /**
     * @since 1.0.0
     */
    protected function accessDeniedMessage(): string
    {
        return __('Sorry, you are not allowed to access this page.', 'fastcgi-cache-for-ploi');
    }

    /**
     * @since 1.0.0
     */
    protected function pageTitle(): string
    {
        return __('FastCGI Cache for Ploi', 'fastcgi-cache-for-ploi');
    }

    /**
     * @since 1.0.0
     */
    protected function menuTitle(): string
    {
        return __('FastCGI Cache', 'fastcgi-cache-for-ploi');
    }

    /**
     * i18n: safe to call __() here — only invoked at render/enqueue, well after
     * init.
     *
     * @since 1.0.0
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
     * @since 1.0.0
     *
     * @return list<string>
     */
    public function tabKeys(): array
    {
        return array_column($this->tabs(), 'key');
    }

    /**
     * Prepends a Settings link to the plugin's row on the Plugins screen,
     * matching core's convention of listing it before Deactivate.
     *
     * @since 1.0.1
     *
     * @param array<string, string> $actions
     *
     * @return array<string, string>
     */
    public function pluginActionLinks(array $actions): array
    {
        $link = sprintf(
            '<a href="%s">%s</a>',
            esc_url($this->url()),
            esc_html__('Settings', 'fastcgi-cache-for-ploi')
        );

        return ['settings' => $link] + $actions;
    }

    /**
     * @since 1.0.0
     */
    protected function renderBody(): void
    {
        require $this->viewPath;
    }

    /**
     * CONTRACT: $name must be a trusted internal literal — it is require'd,
     * never sanitized.
     *
     * @since 1.0.0
     *
     * @param array<string, mixed> $data
     */
    protected function partial(string $name, array $data = []): void
    {
        extract($data, EXTR_OVERWRITE);
        require dirname($this->viewPath) . '/partials/' . $name . '.php';
    }

    /**
     * @since 1.0.0
     */
    public function renderFooter(): void
    {
        require $this->footerPath;
    }

    /**
     * @since 1.0.0
     */
    protected function footerName(): string
    {
        return $this->pluginName;
    }

    /**
     * @since 1.0.0
     */
    protected function footerVersion(): string
    {
        return $this->version;
    }
}
