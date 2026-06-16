<?php

/**
 * Shared footer for the plugin's admin pages.
 *
 * Rendered full-width below all page content via SettingsPage::renderFooter(),
 * so it executes in the page object's scope ($this is the AdminPage). A subtle
 * top border separates it from the content; small muted text reuses the same
 * `tw:` tokens as the rest of the admin UI. Carries the plugin name + version
 * and the trademark/affiliation disclaimer required for wordpress.org.
 *
 * @var \Ploi\FastCgiCache\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<footer class="ploi-cache-footer tw:mt-8 tw:border-t tw:border-gray-200 tw:pt-4 tw:text-[13px] tw:text-gray-500">
    <p class="tw:m-0">
        <strong><?php echo esc_html($this->footerName()); ?></strong>
        <span class="tw:text-gray-400">·</span>
        <?php
        printf(
            /* translators: %s: plugin version number. */
            esc_html__('Version %s', 'ploi-fastcgi-cache'),
            esc_html($this->footerVersion())
        );
        ?>
    </p>
    <p class="tw:m-0 tw:mt-1">
        <?php echo esc_html__('Ploi is a trademark of its respective owner. This plugin is not affiliated with or endorsed by Ploi.', 'ploi-fastcgi-cache'); ?>
    </p>
</footer>
