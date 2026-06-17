<?php

/**
 * "Logs" tab body: the recent-flushes table and its Refresh button. Rendered
 * inside the shared Alpine `x-data="ploiCache"` root (see settings.php), so it
 * stays bound to the same `log` state — a "Flush now" on the Settings tab updates
 * this table live even while hidden. The panel is shown via `activeTab`.
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div x-show="activeTab === '<?php echo esc_js($this::TAB_LOGS); ?>'" role="tabpanel" class="tw:flex tw:flex-col tw:gap-5">
    <!-- Recent flushes -->
    <section class="postbox tw:m-0!">
        <div class="postbox-header">
            <h2 class="hndle tw:m-0! tw:px-4 tw:py-3 tw:text-sm! tw:font-semibold"><?php echo esc_html__('Recent flushes', 'fastcgi-cache-for-ploi'); ?></h2>
            <div class="handle-actions tw:flex tw:items-center tw:pr-2">
                <button type="button" class="button button-small" @click="loadLog()" :disabled="busy.log">
                    <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                        <span x-show="busy.log" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                        <span><?php echo esc_html__('Refresh', 'fastcgi-cache-for-ploi'); ?></span>
                    </span>
                </button>
            </div>
        </div>
        <div class="inside">
            <div x-show="log.length === 0" class="tw:py-6 tw:text-center tw:text-sm tw:text-gray-500">
                <?php echo esc_html__('No flushes recorded yet.', 'fastcgi-cache-for-ploi'); ?>
            </div>

            <table class="wp-list-table widefat striped" x-show="log.length > 0">
                <thead>
                    <tr>
                        <th><?php echo esc_html__('When', 'fastcgi-cache-for-ploi'); ?></th>
                        <th><?php echo esc_html__('Trigger', 'fastcgi-cache-for-ploi'); ?></th>
                        <th><?php echo esc_html__('Target', 'fastcgi-cache-for-ploi'); ?></th>
                        <th><?php echo esc_html__('Result', 'fastcgi-cache-for-ploi'); ?></th>
                        <th><?php echo esc_html__('Duration', 'fastcgi-cache-for-ploi'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <template x-for="entry in log" :key="entry.id">
                        <tr>
                            <td x-text="entry.created_at"></td>
                            <td x-text="entry.reason_label"></td>
                            <td x-text="`${entry.server_id} / ${entry.site_id}`"></td>
                            <td>
                                <span
                                    class="tw:inline-flex tw:items-center tw:rounded tw:px-2 tw:py-0.5 tw:text-[13px] tw:font-medium"
                                    :class="entry.success ? 'tw:bg-green-100 tw:text-green-800' : 'tw:bg-red-100 tw:text-red-800'"
                                    x-text="entry.success
                                        ? '<?php echo esc_js(__('Success', 'fastcgi-cache-for-ploi')); ?>'
                                        : '<?php echo esc_js(__('Failed', 'fastcgi-cache-for-ploi')); ?>'"
                                ></span>
                                <span class="tw:ml-1 tw:inline-flex tw:items-center tw:gap-1 tw:align-middle tw:text-[13px] tw:text-gray-500" x-show="entry.http_code">
                                    <span x-text="`HTTP ${entry.http_code}`"></span>
                                    <span
                                        x-show="entry.hint"
                                        x-data="tooltip"
                                        class="tw:relative tw:inline-flex"
                                        @keydown.escape="hide()"
                                        @click.outside="hide()"
                                    >
                                        <button
                                            type="button"
                                            class="button-link tw:inline-flex tw:items-center tw:align-middle"
                                            @mouseenter="show()"
                                            @mouseleave="hide()"
                                            @focus="show()"
                                            @blur="hide()"
                                            @click="show()"
                                            :aria-label="entry.hint"
                                        >
                                            <span class="dashicons dashicons-editor-help tw:text-[16px]! tw:h-[16px]! tw:w-[16px]! tw:leading-none!" aria-hidden="true"></span>
                                        </button>
                                        <span
                                            x-show="open"
                                            x-transition.opacity
                                            aria-hidden="true"
                                            x-text="entry.hint"
                                            class="tw:absolute tw:top-full tw:left-1/2 tw:z-20 tw:mt-1 tw:-translate-x-1/2 tw:w-max tw:max-w-xs tw:rounded tw:bg-gray-900 tw:px-2 tw:py-1 tw:text-[12px] tw:text-white tw:shadow-lg"
                                        ></span>
                                    </span>
                                </span>
                                <div class="tw:mt-1 tw:text-[13px] tw:text-red-600" x-show="entry.message" x-text="entry.message"></div>
                            </td>
                            <td x-text="`${entry.duration_ms} ms`"></td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
    </section>
</div>
