<?php

/**
 * Reusable WP nav-tab bar, driven by an Alpine state property. Presentational
 * only: it sets the state var on click; persisting/syncing that value (e.g. to
 * the URL hash) is the owning component's concern.
 *
 * @since 1.0.0
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 * @var list<array{key: string, label: string}> $tabs     Tabs in display order.
 * @var string                                   $stateVar Alpine property holding the active key.
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<nav class="nav-tab-wrapper tw:mb-0!" role="tablist" aria-label="<?php echo esc_attr__('Settings sections', 'fastcgi-cache-for-ploi'); ?>">
    <?php foreach ($tabs as $tab) : ?>
        <a
            href="#"
            class="nav-tab"
            role="tab"
            :class="{ 'nav-tab-active': <?php echo esc_attr($stateVar); ?> === '<?php echo esc_js($tab['key']); ?>' }"
            :aria-selected="<?php echo esc_attr($stateVar); ?> === '<?php echo esc_js($tab['key']); ?>'"
            @click.prevent="<?php echo esc_attr($stateVar); ?> = '<?php echo esc_js($tab['key']); ?>'"
        ><?php echo esc_html($tab['label']); ?></a>
    <?php endforeach; ?>
</nav>
