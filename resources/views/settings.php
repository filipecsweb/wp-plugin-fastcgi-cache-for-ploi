<?php

/**
 * GOTCHA: each notice MUST keep .inline — wp-admin common.js hoists
 * .notice:not(.inline) below the <h1>, out of the Alpine x-data scope.
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

        <?php $this->partial('toast-host'); ?>
    </div>

    <?php $this->renderFooter(); ?>
</div>
