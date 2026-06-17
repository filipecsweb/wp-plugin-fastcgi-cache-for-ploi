<?php

/**
 * Settings → FastCGI Cache for Ploi screen.
 *
 * Server-rendered shell. Dynamic state is hydrated from window.PloiCacheConfig
 * and driven by the `ploiCache` Alpine component. Chrome reuses WordPress's own
 * admin classes so it blends into wp-admin: cards are `.postbox`/`.inside`,
 * alerts are `.notice` variants, the log is a `.wp-list-table`, and inputs use
 * `.large-text`/`.small-text`. The `.inline` on each notice is REQUIRED: wp-admin's
 * common.js hoists every `.notice:not(.inline)` out to just below the page <h1>,
 * which would yank our Alpine-bound banners out of the `x-data` scope. `tw:`-prefixed
 * utilities handle only layout/spacing on our own elements. Where a `.notice`/
 * `.postbox` margin fights our flex-gap layout, the v4 important variant wins
 * surgically (e.g. tw:m-0!), so the flex `gap` is the single source of spacing.
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div class="wrap">
    <h1><?php echo esc_html($this->pageTitle()); ?></h1>
    <p class="description">
        <?php echo esc_html__('Automatically flush your Ploi-managed site\'s FastCGI cache when content changes.', 'fastcgi-cache-for-ploi'); ?>
    </p>

    <div
        class="ploi-cache-admin tw:mt-4 tw:flex tw:max-w-3xl tw:flex-col tw:gap-5 tw:text-gray-800"
        x-data="ploiCache"
        x-cloak
    >
        <?php $this->partial('notices'); ?>

        <?php $this->partial('tab-nav', ['tabs' => $this->tabs(), 'stateVar' => 'activeTab']); ?>

        <?php $this->partial('settings-tab'); ?>

        <?php $this->partial('logs-tab'); ?>
    </div>

    <?php $this->renderFooter(); ?>
</div>
