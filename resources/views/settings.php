<?php

/**
 * Settings → Ploi FastCGI Cache screen.
 *
 * Server-rendered shell. Dynamic state is hydrated from window.PloiCacheConfig
 * and driven by the `ploiCache` Alpine component. Layout uses tw:-prefixed
 * Tailwind utilities on our own elements; interactive controls reuse WordPress's
 * native classes. Utilities competing with wp-admin element styles use the v4
 * important variant (e.g. tw:w-full!).
 *
 * @var \Ploi\FastCgiCache\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div class="wrap">
    <h1><?php echo esc_html__('Ploi FastCGI Cache', 'ploi-fastcgi-cache'); ?></h1>
    <p class="description">
        <?php echo esc_html__('Automatically flush your Ploi-managed site\'s FastCGI cache when content changes.', 'ploi-fastcgi-cache'); ?>
    </p>

    <div
        class="ploi-cache-admin tw:mt-4 tw:flex tw:max-w-3xl tw:flex-col tw:gap-4 tw:text-gray-800"
        x-data="ploiCache"
        x-cloak
    >
        <!-- Reconnect banner (decrypt failed) -->
        <div x-show="needsReconnect" class="tw:rounded-md tw:border tw:border-amber-300 tw:bg-amber-50 tw:p-4 tw:text-sm tw:text-amber-900">
            <strong><?php echo esc_html__('Reconnect required.', 'ploi-fastcgi-cache'); ?></strong>
            <?php echo esc_html__('Your saved token could not be read — your site\'s security keys may have changed. Re-enter your Ploi API token below and test the connection.', 'ploi-fastcgi-cache'); ?>
        </div>

        <!-- Setup banner -->
        <div x-show="needsSetup" class="tw:rounded-md tw:border tw:border-blue-200 tw:bg-blue-50 tw:p-4 tw:text-sm tw:text-blue-900">
            <?php echo esc_html__('Finish setup: add a Ploi API token, choose a server and site, then save your settings.', 'ploi-fastcgi-cache'); ?>
        </div>

        <!-- Key-source warning -->
        <div x-show="keyWarning" class="tw:rounded-md tw:border tw:border-gray-200 tw:bg-gray-50 tw:p-4 tw:text-sm tw:text-gray-600">
            <?php
            echo wp_kses(
                __('For stronger security, define a dedicated encryption key in <code>wp-config.php</code>: <code>define( \'PLOI_FASTCGI_CACHE_KEY\', \'…\' );</code>. Otherwise the token is encrypted with keys derived from your database.', 'ploi-fastcgi-cache'),
                ['code' => []]
            );
            ?>
        </div>

        <!-- Notice -->
        <template x-if="notice">
            <div
                class="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:rounded-md tw:border tw:p-3 tw:text-sm"
                :class="notice.type === 'success'
                    ? 'tw:border-green-200 tw:bg-green-50 tw:text-green-800'
                    : 'tw:border-red-200 tw:bg-red-50 tw:text-red-800'"
            >
                <span x-text="notice.text"></span>
                <button type="button" class="tw:font-bold tw:leading-none" @click="dismiss()" aria-label="Dismiss">&times;</button>
            </div>
        </template>

        <!-- Connection -->
        <section class="tw:rounded-lg tw:border tw:border-gray-200 tw:bg-white tw:p-5 tw:shadow-sm">
            <h2 class="tw:m-0 tw:mb-1 tw:text-base tw:font-semibold"><?php echo esc_html__('Connection', 'ploi-fastcgi-cache'); ?></h2>
            <p class="tw:m-0 tw:mb-4 tw:text-sm tw:text-gray-500">
                <?php echo esc_html__('Testing a token verifies it against Ploi and saves it (encrypted) automatically. A saved token is never shown again.', 'ploi-fastcgi-cache'); ?>
            </p>

            <div class="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-end">
                <label class="tw:flex tw:flex-1 tw:flex-col tw:gap-1">
                    <span class="tw:text-sm tw:font-medium"><?php echo esc_html__('Ploi API token', 'ploi-fastcgi-cache'); ?></span>
                    <input
                        type="password"
                        class="regular-text tw:w-full!"
                        autocomplete="off"
                        spellcheck="false"
                        x-model="token"
                        :placeholder="hasToken
                            ? '<?php echo esc_js(__('Token saved — enter a new one to replace it', 'ploi-fastcgi-cache')); ?>'
                            : '<?php echo esc_js(__('Enter your Ploi API token', 'ploi-fastcgi-cache')); ?>'"
                    >
                </label>
                <button type="button" class="button" @click="testConnection()" :disabled="busy.test">
                    <span class="tw:inline-flex tw:items-center tw:gap-2">
                        <span x-show="busy.test" class="tw:inline-block tw:h-3 tw:w-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-gray-400 tw:border-t-transparent"></span>
                        <span x-text="busy.test
                            ? '<?php echo esc_js(__('Testing…', 'ploi-fastcgi-cache')); ?>'
                            : '<?php echo esc_js(__('Test connection', 'ploi-fastcgi-cache')); ?>'"></span>
                    </span>
                </button>
            </div>

            <p class="tw:mt-3 tw:flex tw:items-center tw:gap-2 tw:text-sm">
                <span class="tw:inline-block tw:h-2 tw:w-2 tw:rounded-full" :class="hasToken ? 'tw:bg-green-500' : 'tw:bg-gray-300'"></span>
                <span class="tw:text-gray-600" x-text="hasToken
                    ? '<?php echo esc_js(__('A token is saved.', 'ploi-fastcgi-cache')); ?>'
                    : '<?php echo esc_js(__('No token saved yet.', 'ploi-fastcgi-cache')); ?>'"></span>
            </p>
        </section>

        <!-- Target server / site -->
        <section class="tw:rounded-lg tw:border tw:border-gray-200 tw:bg-white tw:p-5 tw:shadow-sm">
            <h2 class="tw:m-0 tw:mb-4 tw:text-base tw:font-semibold"><?php echo esc_html__('Target', 'ploi-fastcgi-cache'); ?></h2>

            <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
                <label class="tw:flex tw:flex-col tw:gap-1">
                    <span class="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-medium">
                        <?php echo esc_html__('Server', 'ploi-fastcgi-cache'); ?>
                        <span x-show="busy.servers" class="tw:inline-block tw:h-3 tw:w-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-gray-400 tw:border-t-transparent"></span>
                    </span>
                    <select class="tw:w-full!" x-model="serverId" @change="onServerChange()" :disabled="busy.servers || servers.length === 0">
                        <option value=""><?php echo esc_html__('— Select a server —', 'ploi-fastcgi-cache'); ?></option>
                        <template x-for="server in servers" :key="server.id">
                            <option :value="server.id" x-text="server.name"></option>
                        </template>
                    </select>
                    <span class="tw:text-xs tw:text-gray-500" x-show="!busy.servers && servers.length === 0" x-text="hasToken
                        ? '<?php echo esc_js(__('No servers loaded. Test the connection to refresh.', 'ploi-fastcgi-cache')); ?>'
                        : '<?php echo esc_js(__('Add a token to load your servers.', 'ploi-fastcgi-cache')); ?>'"></span>
                </label>

                <label class="tw:flex tw:flex-col tw:gap-1">
                    <span class="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-medium">
                        <?php echo esc_html__('Site', 'ploi-fastcgi-cache'); ?>
                        <span x-show="busy.sites" class="tw:inline-block tw:h-3 tw:w-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-gray-400 tw:border-t-transparent"></span>
                    </span>
                    <select class="tw:w-full!" x-model="siteId" :disabled="busy.sites || !serverId || sites.length === 0">
                        <option value=""><?php echo esc_html__('— Select a site —', 'ploi-fastcgi-cache'); ?></option>
                        <template x-for="site in sites" :key="site.id">
                            <option :value="site.id" x-text="site.domain"></option>
                        </template>
                    </select>
                    <span class="tw:text-xs tw:text-gray-500" x-show="!serverId"><?php echo esc_html__('Choose a server first.', 'ploi-fastcgi-cache'); ?></span>
                </label>
            </div>

            <p class="tw:mt-3 tw:text-xs tw:text-gray-500" x-show="canFlush">
                <?php echo esc_html__('Currently flushing:', 'ploi-fastcgi-cache'); ?>
                <strong x-text="`${saved.serverName || saved.serverId} → ${saved.siteDomain || saved.siteId}`"></strong>
            </p>
        </section>

        <!-- Auto-flush events -->
        <section class="tw:rounded-lg tw:border tw:border-gray-200 tw:bg-white tw:p-5 tw:shadow-sm">
            <div class="tw:mb-4 tw:flex tw:items-center tw:justify-between">
                <h2 class="tw:m-0 tw:text-base tw:font-semibold"><?php echo esc_html__('Flush automatically when…', 'ploi-fastcgi-cache'); ?></h2>
                <div class="tw:flex tw:gap-3 tw:text-xs">
                    <button type="button" class="tw:text-blue-600 tw:underline" @click="setAllEvents(true)"><?php echo esc_html__('Enable all', 'ploi-fastcgi-cache'); ?></button>
                    <button type="button" class="tw:text-blue-600 tw:underline" @click="setAllEvents(false)"><?php echo esc_html__('Disable all', 'ploi-fastcgi-cache'); ?></button>
                </div>
            </div>

            <div class="tw:flex tw:flex-col tw:gap-3">
                <template x-for="event in events" :key="event.key">
                    <label class="tw:flex tw:cursor-pointer tw:items-start tw:gap-3 tw:rounded-md tw:border tw:border-gray-100 tw:p-3 tw:hover:bg-gray-50">
                        <input type="checkbox" class="tw:mt-1!" x-model="enabled[event.key]">
                        <span class="tw:flex tw:flex-col">
                            <span class="tw:text-sm tw:font-medium" x-text="event.label"></span>
                            <span class="tw:text-xs tw:text-gray-500" x-text="event.description"></span>
                        </span>
                    </label>
                </template>
            </div>

            <div class="tw:mt-4 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                <label class="tw:text-sm tw:font-medium" for="ploi-debounce"><?php echo esc_html__('Coalesce bursts within', 'ploi-fastcgi-cache'); ?></label>
                <input
                    id="ploi-debounce"
                    type="number"
                    class="small-text"
                    :min="cfg.debounceMin"
                    :max="cfg.debounceMax"
                    step="1"
                    x-model.number="debounce"
                    :class="debounceValid ? '' : 'tw:border-red-400!'"
                >
                <span class="tw:text-sm tw:text-gray-500"><?php echo esc_html__('seconds', 'ploi-fastcgi-cache'); ?></span>
                <span class="tw:basis-full tw:text-xs tw:text-gray-500"><?php echo esc_html__('0 = flush as soon as possible (no added delay). A burst of changes still triggers a single flush.', 'ploi-fastcgi-cache'); ?></span>
                <span class="tw:basis-full tw:text-xs tw:text-red-600" x-show="!debounceValid" x-text="cfg.i18n.badDebounce"></span>
            </div>
        </section>

        <!-- Actions -->
        <section class="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
            <button type="button" class="button button-primary" @click="save()" :disabled="busy.save || !debounceValid">
                <span class="tw:inline-flex tw:items-center tw:gap-2">
                    <span x-show="busy.save" class="tw:inline-block tw:h-3 tw:w-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-white tw:border-t-transparent"></span>
                    <span x-text="busy.save
                        ? '<?php echo esc_js(__('Saving…', 'ploi-fastcgi-cache')); ?>'
                        : '<?php echo esc_js(__('Save settings', 'ploi-fastcgi-cache')); ?>'"></span>
                </span>
            </button>

            <span class="tw:inline-flex tw:items-center tw:gap-2">
                <button type="button" class="button" @click="flushNow()" :disabled="!canFlush || busy.flush">
                    <span class="tw:inline-flex tw:items-center tw:gap-2">
                        <span x-show="busy.flush" class="tw:inline-block tw:h-3 tw:w-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-gray-400 tw:border-t-transparent"></span>
                        <span x-text="busy.flush
                            ? '<?php echo esc_js(__('Flushing…', 'ploi-fastcgi-cache')); ?>'
                            : '<?php echo esc_js(__('Flush now', 'ploi-fastcgi-cache')); ?>'"></span>
                    </span>
                </button>
                <span class="tw:text-xs tw:text-gray-500" x-show="!canFlush" x-text="flushDisabledReason"></span>
            </span>

            <span class="tw:ml-auto tw:text-xs tw:text-gray-500" x-text="`${enabledCount} <?php echo esc_js(__('of', 'ploi-fastcgi-cache')); ?> ${events.length} <?php echo esc_js(__('events enabled', 'ploi-fastcgi-cache')); ?>`"></span>
        </section>

        <!-- Recent flushes -->
        <section class="tw:rounded-lg tw:border tw:border-gray-200 tw:bg-white tw:p-5 tw:shadow-sm">
            <div class="tw:mb-4 tw:flex tw:items-center tw:justify-between">
                <h2 class="tw:m-0 tw:text-base tw:font-semibold"><?php echo esc_html__('Recent flushes', 'ploi-fastcgi-cache'); ?></h2>
                <button type="button" class="button button-small" @click="loadLog()" :disabled="busy.log">
                    <span class="tw:inline-flex tw:items-center tw:gap-2">
                        <span x-show="busy.log" class="tw:inline-block tw:h-3 tw:w-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-gray-400 tw:border-t-transparent"></span>
                        <span><?php echo esc_html__('Refresh', 'ploi-fastcgi-cache'); ?></span>
                    </span>
                </button>
            </div>

            <div x-show="log.length === 0" class="tw:py-6 tw:text-center tw:text-sm tw:text-gray-500">
                <?php echo esc_html__('No flushes recorded yet.', 'ploi-fastcgi-cache'); ?>
            </div>

            <table class="widefat striped" x-show="log.length > 0">
                <thead>
                    <tr>
                        <th><?php echo esc_html__('When', 'ploi-fastcgi-cache'); ?></th>
                        <th><?php echo esc_html__('Trigger', 'ploi-fastcgi-cache'); ?></th>
                        <th><?php echo esc_html__('Target', 'ploi-fastcgi-cache'); ?></th>
                        <th><?php echo esc_html__('Result', 'ploi-fastcgi-cache'); ?></th>
                        <th><?php echo esc_html__('Duration', 'ploi-fastcgi-cache'); ?></th>
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
                                    class="tw:inline-flex tw:items-center tw:rounded tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium"
                                    :class="entry.success ? 'tw:bg-green-100 tw:text-green-800' : 'tw:bg-red-100 tw:text-red-800'"
                                    x-text="entry.success
                                        ? '<?php echo esc_js(__('Success', 'ploi-fastcgi-cache')); ?>'
                                        : '<?php echo esc_js(__('Failed', 'ploi-fastcgi-cache')); ?>'"
                                ></span>
                                <span class="tw:ml-1 tw:text-xs tw:text-gray-500" x-show="entry.http_code" x-text="`HTTP ${entry.http_code}`"></span>
                                <div class="tw:mt-1 tw:text-xs tw:text-red-600" x-show="entry.message" x-text="entry.message"></div>
                            </td>
                            <td x-text="`${entry.duration_ms} ms`"></td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </section>
    </div>
</div>
