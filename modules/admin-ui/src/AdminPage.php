<?php

declare(strict_types=1);

namespace WPForge\Module\AdminUi;

/**
 * Reusable base for an admin screen.
 *
 * Placement is decided by parentSlug():
 *   - return null            => a top-level menu (add_menu_page)
 *   - return 'options-general.php' (etc.) => a submenu (add_submenu_page)
 *
 * So the SAME page class works as either a top-level menu or a submenu without
 * code changes (Constraint 2). register() captures the resulting hook suffix so
 * assets can be scoped to exactly this screen.
 */
abstract class AdminPage
{
    private string $hookSuffix = '';

    abstract protected function slug(): string;

    abstract protected function pageTitle(): string;

    abstract protected function menuTitle(): string;

    abstract protected function renderBody(): void;

    protected function capability(): string
    {
        return 'manage_options';
    }

    /**
     * Parent menu slug for a submenu, or null for a top-level menu.
     */
    protected function parentSlug(): ?string
    {
        return null;
    }

    /**
     * Dashicon for a top-level menu (ignored for submenus).
     */
    protected function icon(): string
    {
        return 'dashicons-performance';
    }

    protected function position(): ?int
    {
        return null;
    }

    public function register(): void
    {
        $parent = $this->parentSlug();

        if ($parent === null) {
            $this->hookSuffix = add_menu_page(
                $this->pageTitle(),
                $this->menuTitle(),
                $this->capability(),
                $this->slug(),
                [$this, 'render'],
                $this->icon(),
                $this->position()
            );

            return;
        }

        $hookSuffix = add_submenu_page(
            $parent,
            $this->pageTitle(),
            $this->menuTitle(),
            $this->capability(),
            $this->slug(),
            [$this, 'render'],
            $this->position()
        );

        $this->hookSuffix = is_string($hookSuffix) ? $hookSuffix : '';
    }

    public function render(): void
    {
        if (! current_user_can($this->capability())) {
            // phpcs:ignore WordPress.WP.I18n.TextDomainMismatch -- Intentionally reuses WordPress core's own translation of this standard capability-denied message.
            wp_die(esc_html__('Sorry, you are not allowed to access this page.', 'default'));
        }

        $this->renderBody();
    }

    /**
     * The admin-page hook suffix (e.g. "settings_page_ploi-fastcgi-cache").
     * Only populated after register() has run on the admin_menu hook.
     */
    public function hookSuffix(): string
    {
        return $this->hookSuffix;
    }

    public function slugName(): string
    {
        return $this->slug();
    }
}
