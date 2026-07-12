<?php

/**
 * Persistent state banners for the settings screen, rendered inside the Alpine root
 * but ABOVE both tab panels so they stay visible whichever tab is active. Transient
 * confirmations/errors go through the toast host, not here.
 *
 * The `inline` class on each notice is REQUIRED: wp-admin's common.js hoists every
 * `.notice:not(.inline)` up to just below the page <h1>, which would yank these
 * Alpine-bound banners out of the `x-data` scope.
 *
 * @since 1.0.0
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div x-show="needsReconnect" class="notice notice-error inline tw:m-0!" role="status" aria-live="polite">
    <p>
        <strong><?php echo esc_html__('Reconnect required.', 'fastcgi-cache-for-ploi'); ?></strong>
        <span x-text="cfg.i18n.reconnect[reconnectReason] || cfg.i18n.reconnect.unreadable"></span>
    </p>
</div>

<div x-show="keyWarning" class="notice notice-warning inline tw:m-0!">
    <p class="tw:flex tw:items-start tw:gap-2">
        <span class="dashicons dashicons-shield tw:mt-0.5 tw:shrink-0" aria-hidden="true"></span>
        <span>
            <strong><?php echo esc_html__('Harden your token\'s encryption key', 'fastcgi-cache-for-ploi'); ?></strong><br>
            <?php
            echo wp_kses(
                __('Your WordPress security keys (salts) aren\'t defined in <code>wp-config.php</code>. Define them — or add a dedicated key — so the key that encrypts your token lives in <code>wp-config.php</code>, separate from your database: <code>define( \'FASTCGI_CACHE_FOR_PLOI_KEY\', \'…\' );</code>', 'fastcgi-cache-for-ploi'),
                ['code' => []]
            );
            ?>
        </span>
    </p>
</div>
