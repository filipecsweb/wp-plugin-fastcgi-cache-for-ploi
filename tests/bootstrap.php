<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

if (! defined('ABSPATH')) {
    define('ABSPATH', sys_get_temp_dir() . '/');
}

if (! defined('WP_PLUGIN_DIR')) {
    define('WP_PLUGIN_DIR', ABSPATH . 'wp-content/plugins');
}
