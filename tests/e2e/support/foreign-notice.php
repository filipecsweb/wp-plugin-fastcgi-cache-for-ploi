<?php
/**
 * Plugin Name: FastCGI Cache for Ploi E2E foreign notice
 * Description: Test fixture from tests/e2e/setup-site.sh. Prints an admin notice only for a request carrying its cookie, so it is inert for anyone else on the site.
 *
 * CONTRACT: shell.spec.js sets the cookie and looks up the notice by this id.
 */
add_action('admin_notices', static function (): void {
    if (isset($_COOKIE['fastcgi_cache_for_ploi_e2e_notice'])) {
        echo '<div id="fastcgi-cache-for-ploi-e2e-notice" class="notice notice-warning"><p>E2E foreign notice</p></div>';
    }
});
