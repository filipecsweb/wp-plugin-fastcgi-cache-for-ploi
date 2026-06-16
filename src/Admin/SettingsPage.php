<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Admin;

use WPForge\Module\AdminUi\AdminPage;

/**
 * The "Settings → FastCGI Cache for Ploi" screen.
 *
 * Placed as a submenu under Settings (Constraint 2) by returning a parent slug;
 * returning null instead would make the very same class a top-level menu.
 */
final class SettingsPage extends AdminPage
{
    public const SLUG = 'ploi-fastcgi-cache';

    public function __construct(private readonly string $viewPath)
    {
    }

    protected function slug(): string
    {
        return self::SLUG;
    }

    protected function parentSlug(): string
    {
        return 'options-general.php';
    }

    protected function pageTitle(): string
    {
        return __('FastCGI Cache for Ploi', 'ploi-fastcgi-cache');
    }

    protected function menuTitle(): string
    {
        return __('FastCGI Cache', 'ploi-fastcgi-cache');
    }

    protected function renderBody(): void
    {
        require $this->viewPath;
    }
}
