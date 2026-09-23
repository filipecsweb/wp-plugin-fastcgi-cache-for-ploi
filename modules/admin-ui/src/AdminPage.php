<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Module\AdminUi;

/**
 * One subclass works as either top-level menu or submenu purely via
 * parentSlug()'s return. CONTRACT: a null parentSlug() makes the page a
 * top-level menu instead of a submenu.
 *
 * @since 1.0.0
 */
abstract class AdminPage
{
    /**
     * @since 1.1.0
     */
    private const NOTICE_HOOKS = ['admin_notices', 'all_admin_notices', 'network_admin_notices', 'user_admin_notices'];

    /**
     * @since 1.0.0
     */
    private string $hookSuffix = '';

    /**
     * @since 1.0.0
     */
    abstract protected function slug(): string;

    /**
     * @since 1.0.0
     */
    abstract protected function pageTitle(): string;

    /**
     * @since 1.0.0
     */
    abstract protected function menuTitle(): string;

    /**
     * @since 1.0.0
     */
    abstract protected function renderBody(): void;

    /**
     * @since 1.0.0
     */
    protected function capability(): string
    {
        return 'manage_options';
    }

    /**
     * @since 1.0.0
     */
    protected function parentSlug(): ?string
    {
        return null;
    }

    /**
     * Silently ignored for submenus (add_submenu_page takes no icon).
     *
     * @since 1.0.0
     */
    protected function icon(): string
    {
        return 'dashicons-performance';
    }

    /**
     * @since 1.0.0
     */
    protected function position(): ?int
    {
        return null;
    }

    /**
     * @since 1.1.0 Also silences every admin notice on the page's own screen.
     * @since 1.0.0
     */
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
        } else {
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

        // WHY manual: the hook name embeds the runtime hook suffix, which a compile-time
        // #[Action] attribute can't express.
        if ($this->hookSuffix !== '') {
            add_action('load-' . $this->hookSuffix, [$this, 'silenceNotices']);
        }
    }

    /**
     * WHY in_admin_header, last: it fires after every plugin has queued its notices and
     * right before core prints them, so none reaches the screen, not even for a frame.
     *
     * @since 1.1.0
     */
    public function silenceNotices(): void
    {
        add_action('in_admin_header', static function (): void {
            foreach (self::NOTICE_HOOKS as $hook) {
                remove_all_actions($hook);
            }
        }, PHP_INT_MAX);
    }

    /**
     * @since 1.0.0
     */
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
     *
     * @since 1.0.0
     */
    protected function accessDeniedMessage(): string
    {
        return 'Sorry, you are not allowed to access this page.';
    }

    /**
     * Empty until register() runs on admin_menu.
     *
     * @since 1.0.0
     */
    public function hookSuffix(): string
    {
        return $this->hookSuffix;
    }

    /**
     * Built from the slug (not the menu registration), so it's valid before
     * register() runs on admin_menu.
     *
     * @since 1.0.1
     */
    public function url(): string
    {
        return admin_url(add_query_arg('page', $this->slug(), $this->parentSlug() ?? 'admin.php'));
    }
}
