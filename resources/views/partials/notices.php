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
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div x-show="needsReconnect" class="notice notice-warning inline tw:m-0!">
    <p>
        <strong><?php echo esc_html__('Reconnect required.', 'fastcgi-cache-for-ploi'); ?></strong>
        <span x-text="cfg.i18n.reconnect[reconnectReason] || cfg.i18n.reconnect.unreadable"></span>
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
