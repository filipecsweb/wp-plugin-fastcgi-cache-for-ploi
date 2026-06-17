<?php

/**
 * Shared notices for the settings screen, rendered inside the Alpine root but
 * ABOVE both tab panels so they stay visible whichever tab is active — the
 * dynamic `notice` is raised from actions on both tabs (e.g. save/flush on
 * Settings, log refresh on Logs).
 *
 * The `inline` class on each notice is REQUIRED: wp-admin's common.js hoists every
 * `.notice:not(.inline)` up to just below the page <h1>, which would yank these
 * Alpine-bound banners out of the `x-data` scope.
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div x-show="needsReconnect" class="notice notice-warning inline tw:m-0!">
    <p>
        <strong><?php echo esc_html__('Reconnect required.', 'fastcgi-cache-for-ploi'); ?></strong>
        <?php echo esc_html__('Your saved token could not be read — your site\'s security keys may have changed. Re-enter your Ploi API token below, then test and save it.', 'fastcgi-cache-for-ploi'); ?>
    </p>
</div>

<div x-show="keyWarning" class="notice notice-info inline tw:m-0!">
    <p>
    <?php
    echo wp_kses(
        __('For stronger security, define a dedicated encryption key in <code>wp-config.php</code>: <code>define( \'FASTCGI_CACHE_FOR_PLOI_KEY\', \'…\' );</code>. Otherwise the token is encrypted with keys derived from your database.', 'fastcgi-cache-for-ploi'),
        ['code' => []]
    );
    ?>
    </p>
</div>

<template x-if="notice">
    <div
        class="notice inline is-dismissible tw:m-0!"
        :class="notice.type === 'success' ? 'notice-success' : notice.type === 'warning' ? 'notice-warning' : 'notice-error'"
        role="alert"
    >
        <p x-text="notice.text"></p>
        <button type="button" class="notice-dismiss" @click="dismiss()">
            <span class="screen-reader-text"><?php echo esc_html__('Dismiss this notice.', 'fastcgi-cache-for-ploi'); ?></span>
        </button>
    </div>
</template>
