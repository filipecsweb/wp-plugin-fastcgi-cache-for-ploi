<?php

/**
 * Auto-flush probe for the e2e suite. Invoked as:
 *   wp eval-file tests/e2e/support/autoflush-probe.php <action> <eventKey>
 *
 * Seeds a configured connection with ONLY <eventKey> enabled, performs <action>
 * (firing the matching content-change hook in-process), and prints ONE JSON line:
 *   { scheduled: bool, reason: string|null, loggedReason: string|null }
 *
 * Everything runs synchronously in this single process, so there is no async
 * WP-Cron race (the flake that makes `wp post create` + `wp cron event run`
 * unreliable: a web request can spawn wp-cron and consume the event first). It
 * seeds via the plugin's own Crypto so the token decrypts, runs the coalesced
 * flush via do_action when one was scheduled, reads the reason actually written
 * to the log, then cleans up everything it created.
 *
 * @var array<int,string> $args provided by WP-CLI eval-file
 */

defined('ABSPATH') || exit;

$action = $args[0] ?? '';
$eventKey = $args[1] ?? '';

$events = array_fill_keys(\Ploi\FastCgiCache\Cache\FlushEvents::keys(), false);
if (array_key_exists($eventKey, $events)) {
    $events[$eventKey] = true;
}

$crypto = new \WPForge\Security\Crypto();
update_option('ploi_fastcgi_cache_settings', [
    'token' => $crypto->encrypt('seed-token-e2e'),
    'server_id' => '7',
    'site_id' => '42',
    'server_name' => 'S',
    'site_domain' => 'd',
    'events' => $events,
    'debounce' => 0,
    'needs_reconnect' => false,
]);

$reset = static function (): void {
    delete_transient('ploi_fastcgi_cache_pending');
    wp_clear_scheduled_hook('ploi_fastcgi_cache_flush');
};
$reset();

$cleanup = [];
$makePost = static function () use (&$cleanup): int {
    $id = (int) wp_insert_post([
        'post_title' => 'e2e-autoflush',
        'post_status' => 'publish',
        'post_type' => 'post',
        'post_content' => 'x',
    ]);
    $cleanup[] = static function () use ($id): void {
        wp_delete_post($id, true);
    };
    return $id;
};
$makeComment = static function (int $postId) use (&$cleanup): int {
    $id = (int) wp_insert_comment([
        'comment_post_ID' => $postId,
        'comment_content' => 'hi',
        'comment_approved' => 1,
    ]);
    $cleanup[] = static function () use ($id): void {
        wp_delete_comment($id, true);
    };
    return $id;
};

switch ($action) {
    case 'publish_post':
        $makePost();
        break;
    case 'delete_post':
        $id = $makePost();
        $reset(); // measure the DELETE hook, not the create
        wp_delete_post($id, true);
        break;
    case 'comment_post':
        $cid = $makeComment($makePost());
        $reset();
        do_action('comment_post', $cid, 1);
        break;
    case 'comment_transition':
        $cid = $makeComment($makePost());
        $reset();
        do_action('transition_comment_status', 'approved', 'unapproved', get_comment($cid));
        break;
    case 'comment_edit':
        $cid = $makeComment($makePost());
        $reset();
        do_action('edit_comment', $cid);
        break;
}

$scheduled = (bool) wp_next_scheduled('ploi_fastcgi_cache_flush');
$reason = get_transient('ploi_fastcgi_cache_pending');
$loggedReason = null;

if ($scheduled) {
    do_action('ploi_fastcgi_cache_flush'); // runScheduled → flush → log (real Ploi call; logs the reason regardless of result)
    global $wpdb;
    $loggedReason = $wpdb->get_var("SELECT reason FROM {$wpdb->prefix}ploi_flush_log ORDER BY id DESC LIMIT 1");
}

$reset();
foreach ($cleanup as $fn) {
    $fn();
}
delete_option('ploi_fastcgi_cache_settings');

echo wp_json_encode([
    'scheduled' => $scheduled,
    'reason' => is_string($reason) ? $reason : null,
    'loggedReason' => $loggedReason,
]);
