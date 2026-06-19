<?php

declare(strict_types=1);

namespace WPForge\Module\AdminUi;

/**
 * One subclass works as either top-level menu or submenu purely via
 * parentSlug()'s return.
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

    protected function parentSlug(): ?string
    {
        return null;
    }

    /**
     * Silently ignored for submenus (add_submenu_page takes no icon).
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
            wp_die(esc_html($this->accessDeniedMessage()));
        }

        $this->renderBody();
    }

    /**
     * WHY untranslated: this kernel module stays slug-agnostic, so it carries no
     * gettext call of its own. Concrete pages override this to return the message
     * translated under their plugin's text domain.
     */
    protected function accessDeniedMessage(): string
    {
        return 'Sorry, you are not allowed to access this page.';
    }

    /**
     * Empty until register() runs on admin_menu.
     */
    public function hookSuffix(): string
    {
        return $this->hookSuffix;
    }
}
