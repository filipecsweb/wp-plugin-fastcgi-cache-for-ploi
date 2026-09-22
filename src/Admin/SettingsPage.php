<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Admin;

use FastCgiCacheForPloi\Providers\RestServiceProvider;
use FastCgiCacheForPloi\Module\AdminUi\AdminPage;

/**
 * @since 1.1.0 Prints only the React screen's mount; the PHP views and their helpers are gone.
 * @since 1.0.0
 */
final class SettingsPage extends AdminPage
{
    /**
     * @since 1.0.0
     */
    public const SLUG = 'fastcgi-cache-for-ploi';

    /**
     * Mount element of the React screen. CONTRACT: resources/js/app/main.tsx mounts
     * on this id and resources/css/app.css scopes its reset to it.
     *
     * @since 1.1.0
     */
    public const APP_ROOT_ID = 'fastcgi-cache-for-ploi-app';

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
     * The heading and description stay outside the mount as ordinary wp-admin
     * chrome; React renders everything inside it.
     *
     * @since 1.1.0 Prints the React mount instead of requiring a view.
     * @since 1.0.0
     */
    protected function renderBody(): void
    {
        printf(
            '<div class="wrap"><h1>%s</h1><p class="description">%s</p><div id="%s"></div></div>',
            esc_html($this->pageTitle()),
            esc_html__('Automatically flush your Ploi-managed site\'s FastCGI cache when content changes.', 'fastcgi-cache-for-ploi'),
            esc_attr(self::APP_ROOT_ID)
        );
    }
}
