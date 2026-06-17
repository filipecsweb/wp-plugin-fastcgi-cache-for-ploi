<?php

/**
 * "Settings" tab body: Connection, Target, the auto-flush events + coalesce
 * window, and the Save / Flush-now actions. Rendered inside the shared Alpine
 * `x-data="ploiCache"` root (see settings.php), so every binding below resolves
 * against that one component. The panel is shown via `activeTab`.
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div x-show="activeTab === '<?php echo esc_js($this::TAB_SETTINGS); ?>'" role="tabpanel" class="tw:flex tw:flex-col tw:gap-5">
    <!-- Connection -->
    <section class="postbox tw:m-0!">
        <div class="postbox-header">
            <h2 class="hndle tw:m-0! tw:px-4 tw:py-3 tw:text-sm! tw:font-semibold"><?php echo esc_html__('Connection', 'fastcgi-cache-for-ploi'); ?></h2>
        </div>
        <div class="inside">
            <div class="tw:flex tw:flex-col tw:gap-3">
                <p class="description tw:m-0!">
                    <?php echo esc_html__('Testing checks your token against Ploi without saving it. Click Save settings to store it (encrypted); a saved token is never shown again.', 'fastcgi-cache-for-ploi'); ?>
                </p>

                <div class="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-end">
                    <label class="tw:flex tw:flex-1 tw:flex-col tw:gap-1">
                        <span class="tw:text-sm tw:font-semibold"><?php echo esc_html__('Ploi API token', 'fastcgi-cache-for-ploi'); ?></span>
                        <input
                            type="password"
                            class="large-text tw:w-full!"
                            autocomplete="off"
                            spellcheck="false"
                            x-model="token"
                            :placeholder="hasToken
                                ? '<?php echo esc_js(__('Token saved — enter a new one to replace it', 'fastcgi-cache-for-ploi')); ?>'
                                : '<?php echo esc_js(__('Enter your Ploi API token', 'fastcgi-cache-for-ploi')); ?>'"
                        >
                    </label>
                    <button type="button" class="button" @click="testToken()" :disabled="busy.test">
                        <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                            <span x-show="busy.test" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                            <span x-text="busy.test
                                ? '<?php echo esc_js(__('Testing…', 'fastcgi-cache-for-ploi')); ?>'
                                : '<?php echo esc_js(__('Test token', 'fastcgi-cache-for-ploi')); ?>'"></span>
                        </span>
                    </button>
                </div>

                <p class="description tw:m-0!">
                    <?php
                    printf(
                        /* translators: 1: <strong>-wrapped breadcrumb to the Ploi API keys screen; 2: opening <a> tag; 3: closing </a> tag; 4: <code>-wrapped example token name. */
                        esc_html__('Paste a Ploi API token to connect. Create one in %1$s (%2$sopen ↗%3$s) and name it something like %4$s so it\'s easy to find and revoke later.', 'fastcgi-cache-for-ploi'),
                        '<strong>' . esc_html__('Ploi → API keys', 'fastcgi-cache-for-ploi') . '</strong>',
                        '<a href="' . esc_url('https://ploi.io/profile/api-keys') . '" target="_blank" rel="noopener noreferrer">',
                        '</a>',
                        '<code class="tw:mx-1!">' . esc_html__('FastCGI Cache — yoursite.com', 'fastcgi-cache-for-ploi') . '</code>'
                    );
                    ?>
                </p>

                <div class="tw:flex tw:flex-col tw:gap-3">
                    <div class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
                        <span
                            class="tw:inline-block tw:h-2 tw:w-2 tw:rounded-full"
                            :class="!hasToken ? 'tw:bg-gray-300' : (tokenRejected ? 'tw:bg-amber-500' : 'tw:bg-green-500')"
                        ></span>
                        <span class="tw:text-gray-600" x-text="!hasToken
                            ? '<?php echo esc_js(__('No token saved yet.', 'fastcgi-cache-for-ploi')); ?>'
                            : (tokenRejected
                                ? '<?php echo esc_js(__('Token saved, but Ploi rejected it — test your token again.', 'fastcgi-cache-for-ploi')); ?>'
                                : '<?php echo esc_js(__('A token is saved.', 'fastcgi-cache-for-ploi')); ?>')"></span>
                        <button
                            type="button"
                            class="button-link button-link-delete tw:ml-auto"
                            x-show="hasToken && !confirmingDisconnect"
                            @click="askDisconnect()"
                        ><?php echo esc_html__('Disconnect', 'fastcgi-cache-for-ploi'); ?></button>
                    </div>

                    <!-- Inline destructive confirm (no native dialog) -->
                    <div x-show="confirmingDisconnect" class="notice notice-warning inline tw:m-0!" role="alert">
                        <p><?php echo esc_html__('Remove the saved token? Flushing will stop until you reconnect.', 'fastcgi-cache-for-ploi'); ?></p>
                        <p class="tw:flex tw:items-center tw:gap-2">
                            <button type="button" class="button button-small" @click="disconnect()" :disabled="busy.disconnect">
                                <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                                    <span x-show="busy.disconnect" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                                    <span x-text="busy.disconnect
                                        ? '<?php echo esc_js(__('Disconnecting…', 'fastcgi-cache-for-ploi')); ?>'
                                        : '<?php echo esc_js(__('Yes, disconnect', 'fastcgi-cache-for-ploi')); ?>'"></span>
                                </span>
                            </button>
                            <button type="button" class="button button-small" @click="cancelDisconnect()" :disabled="busy.disconnect"><?php echo esc_html__('Cancel', 'fastcgi-cache-for-ploi'); ?></button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Target server / site -->
    <section class="postbox tw:m-0!">
        <div class="postbox-header">
            <h2 class="hndle tw:m-0! tw:px-4 tw:py-3 tw:text-sm! tw:font-semibold"><?php echo esc_html__('Target', 'fastcgi-cache-for-ploi'); ?></h2>
        </div>
        <div class="inside">
            <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
                <label class="tw:flex tw:flex-col tw:gap-1">
                    <span class="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-semibold">
                        <?php echo esc_html__('Server', 'fastcgi-cache-for-ploi'); ?>
                        <span x-show="busy.servers" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                    </span>
                    <select class="tw:w-full!" x-model="serverId" @change="onServerChange()" :disabled="busy.servers || servers.length === 0">
                        <option value=""><?php echo esc_html__('— Select a server —', 'fastcgi-cache-for-ploi'); ?></option>
                        <template x-for="server in servers" :key="server.id">
                            <option :value="server.id" x-text="server.name"></option>
                        </template>
                    </select>
                    <span class="tw:text-[13px] tw:text-gray-500" x-show="!busy.servers && servers.length === 0" x-text="hasToken
                        ? '<?php echo esc_js(__('No servers loaded. Save your settings to refresh.', 'fastcgi-cache-for-ploi')); ?>'
                        : '<?php echo esc_js(__('Add a token to load your servers.', 'fastcgi-cache-for-ploi')); ?>'"></span>
                </label>

                <label class="tw:flex tw:flex-col tw:gap-1">
                    <span class="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-semibold">
                        <?php echo esc_html__('Site', 'fastcgi-cache-for-ploi'); ?>
                        <span x-show="busy.sites" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                    </span>
                    <select class="tw:w-full!" x-model="siteId" :disabled="busy.sites || !serverId || sites.length === 0">
                        <option value=""><?php echo esc_html__('— Select a site —', 'fastcgi-cache-for-ploi'); ?></option>
                        <template x-for="site in sites" :key="site.id">
                            <option :value="site.id" x-text="site.domain"></option>
                        </template>
                    </select>
                    <span class="tw:text-[13px] tw:text-gray-500" x-show="!serverId"><?php echo esc_html__('Choose a server first.', 'fastcgi-cache-for-ploi'); ?></span>
                </label>
            </div>

            <p class="tw:mt-3 tw:text-[13px] tw:text-gray-500" x-show="canFlush">
                <?php echo esc_html__('Currently flushing:', 'fastcgi-cache-for-ploi'); ?>
                <strong x-text="`${saved.serverName || saved.serverId} → ${saved.siteDomain || saved.siteId}`"></strong>
            </p>
        </div>
    </section>

    <!-- Auto-flush events -->
    <section class="postbox tw:m-0!">
        <div class="postbox-header">
            <h2 class="hndle tw:m-0! tw:px-4 tw:py-3 tw:text-sm! tw:font-semibold"><?php echo esc_html__('Flush automatically when…', 'fastcgi-cache-for-ploi'); ?></h2>
            <div class="handle-actions tw:flex tw:items-center tw:gap-3 tw:pr-2">
                <button type="button" class="button-link" @click="setAllEvents(true)"><?php echo esc_html__('Enable all', 'fastcgi-cache-for-ploi'); ?></button>
                <button type="button" class="button-link" @click="setAllEvents(false)"><?php echo esc_html__('Disable all', 'fastcgi-cache-for-ploi'); ?></button>
            </div>
        </div>
        <div class="inside">
            <div class="tw:flex tw:flex-col tw:gap-3">
                <template x-for="event in events" :key="event.key">
                    <label class="tw:flex tw:cursor-pointer tw:items-start tw:gap-3 tw:rounded-md tw:border tw:border-gray-100 tw:p-3 tw:hover:bg-gray-50">
                        <input type="checkbox" class="tw:mt-1!" x-model="enabled[event.key]">
                        <span class="tw:flex tw:flex-col">
                            <span class="tw:text-sm tw:font-semibold" x-text="event.label"></span>
                            <span class="tw:text-[13px] tw:text-gray-500" x-text="event.description"></span>
                        </span>
                    </label>
                </template>
            </div>

            <div class="tw:mt-4 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                <label class="tw:text-sm tw:font-semibold" for="ploi-debounce"><?php echo esc_html__('Coalesce bursts within', 'fastcgi-cache-for-ploi'); ?></label>
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
                <span class="tw:text-sm tw:text-gray-500"><?php echo esc_html__('seconds', 'fastcgi-cache-for-ploi'); ?></span>
                <span class="tw:basis-full tw:text-[13px] tw:text-gray-500"><?php echo esc_html__('0 = flush as soon as possible (no added delay). A burst of changes still triggers a single flush.', 'fastcgi-cache-for-ploi'); ?></span>
                <span class="tw:basis-full tw:text-[13px] tw:text-red-600" x-show="!debounceValid" x-text="cfg.i18n.badDebounce"></span>
            </div>
        </div>
    </section>

    <!-- Actions -->
    <section class="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <button type="button" class="button button-primary" @click="save()" :disabled="busy.save || !debounceValid">
            <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                <span x-show="busy.save" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                <span x-text="busy.save
                    ? '<?php echo esc_js(__('Saving…', 'fastcgi-cache-for-ploi')); ?>'
                    : '<?php echo esc_js(__('Save settings', 'fastcgi-cache-for-ploi')); ?>'"></span>
            </span>
        </button>

        <span class="tw:inline-flex tw:items-center tw:gap-2">
            <button type="button" class="button" @click="flushNow()" :disabled="!canFlush || busy.flush">
                <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                    <span x-show="busy.flush" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                    <span x-text="busy.flush
                        ? '<?php echo esc_js(__('Flushing…', 'fastcgi-cache-for-ploi')); ?>'
                        : '<?php echo esc_js(__('Flush now', 'fastcgi-cache-for-ploi')); ?>'"></span>
                </span>
            </button>
            <span class="tw:text-[13px] tw:text-gray-500" x-show="!canFlush" x-text="flushDisabledReason"></span>
        </span>
    </section>
</div>
