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

    protected function renderBody(): void
    {
        require $this->viewPath;
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
