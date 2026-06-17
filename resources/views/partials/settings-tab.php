<?php

/**
 * Bindings below resolve against the ambient x-data="ploiCache" root
 * (settings.php); this partial defines no x-data of its own.
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div x-show="activeTab === '<?php echo esc_js($this::TAB_SETTINGS); ?>'" role="tabpanel" class="tw:flex tw:flex-col tw:gap-5">
    <section class="postbox tw:m-0!">
        <div class="postbox-header">
            <h2 class="hndle tw:m-0! tw:px-4 tw:py-3 tw:text-sm! tw:font-semibold"><?php echo esc_html__('Connection', 'fastcgi-cache-for-ploi'); ?></h2>
        </div>
        <div class="inside">
            <div class="tw:flex tw:flex-col tw:gap-3">
                <p class="description tw:m-0!">
                    <?php echo esc_html__('Connecting validates your token with Ploi and stores it encrypted; a saved token is never shown again. Disconnect to enter a different one.', 'fastcgi-cache-for-ploi'); ?>
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
                            :disabled="hasToken"
                            @keydown.enter.prevent="hasToken || connect()"
                            :placeholder="hasToken
                                ? '<?php echo esc_js(__('Connected — disconnect to enter a new token', 'fastcgi-cache-for-ploi')); ?>'
                                : '<?php echo esc_js(__('Enter your Ploi API token', 'fastcgi-cache-for-ploi')); ?>'"
                        >
                    </label>
                    <button type="button" class="button button-primary" x-show="!hasToken" @click="connect()" :disabled="busy.connect">
                        <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                            <span x-show="busy.connect" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                            <span x-text="busy.connect
                                ? '<?php echo esc_js(__('Connecting…', 'fastcgi-cache-for-ploi')); ?>'
                                : '<?php echo esc_js(__('Connect', 'fastcgi-cache-for-ploi')); ?>'"></span>
                        </span>
                    </button>
                    <button type="button" class="button" x-show="hasToken" @click="disconnect()" :disabled="busy.disconnect">
                        <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                            <span x-show="busy.disconnect" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                            <span x-text="busy.disconnect
                                ? '<?php echo esc_js(__('Disconnecting…', 'fastcgi-cache-for-ploi')); ?>'
                                : '<?php echo esc_js(__('Disconnect', 'fastcgi-cache-for-ploi')); ?>'"></span>
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

                <div class="tw:flex tw:flex-col tw:gap-1 tw:border-t tw:border-gray-100 tw:pt-4">
                    <span class="tw:text-sm tw:font-semibold"><?php echo esc_html__('Flush target (Server and Site)', 'fastcgi-cache-for-ploi'); ?></span>
                    <p class="tw:m-0! tw:text-[13px] tw:text-gray-600" x-show="canFlush">
                        <?php echo esc_html__('Currently flushing:', 'fastcgi-cache-for-ploi'); ?>
                        <strong x-text="`${saved.serverName || saved.serverId} → ${saved.siteDomain || saved.siteId}`"></strong>
                    </p>
                    <span class="tw:text-[13px] tw:text-gray-500" x-show="!canFlush && flushDisabledReason" x-text="flushDisabledReason"></span>
                    <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
                        <button type="button" class="button" x-show="hasToken && !needsReconnect" @click="openTargetModal()" x-text="canFlush
                            ? '<?php echo esc_js(__('Change', 'fastcgi-cache-for-ploi')); ?>'
                            : '<?php echo esc_js(__('Select target', 'fastcgi-cache-for-ploi')); ?>'"></button>
                        <button type="button" class="button tw:ml-auto" @click="flushNow()" :disabled="!canFlush || busy.flush">
                            <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                                <span x-show="busy.flush" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                                <span x-text="busy.flush
                                    ? '<?php echo esc_js(__('Flushing…', 'fastcgi-cache-for-ploi')); ?>'
                                    : '<?php echo esc_js(__('Flush now', 'fastcgi-cache-for-ploi')); ?>'"></span>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="postbox tw:m-0!">
        <div class="postbox-header">
            <h2 class="hndle tw:m-0! tw:px-4 tw:py-3 tw:text-sm! tw:font-semibold"><?php echo esc_html__('Flush automatically when…', 'fastcgi-cache-for-ploi'); ?></h2>
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
        </div>
    </section>
    <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <?php $this->partial('save-button'); ?>
    </div>

    <?php $this->partial('modal', [
        'state'   => 'targetModalOpen',
        'title'   => __('Change flush target', 'fastcgi-cache-for-ploi'),
        'titleId' => 'ploi-target-modal-title',
        'body'    => 'target-form',
    ]); ?>
</div>
