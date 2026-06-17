<?php

/**
 * Body of the "change flush target" modal: server + site pickers and the actions.
 * Resolves against the ambient x-data="ploiCache" root (settings.php).
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div class="tw:flex tw:flex-col tw:gap-4">
    <div x-show="targetError" class="notice notice-error inline tw:m-0!" role="alert">
        <p x-text="targetError"></p>
    </div>

    <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
        <label class="tw:flex tw:flex-col tw:gap-1">
            <span class="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-semibold">
                <?php echo esc_html__('Server', 'fastcgi-cache-for-ploi'); ?>
                <span x-show="busy.servers" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
            </span>
            <select class="tw:w-full!" @change="serverId = $event.target.value; onServerChange()" :disabled="busy.servers || servers.length === 0">
                <option value="" :selected="!serverId"><?php echo esc_html__('— Select a server —', 'fastcgi-cache-for-ploi'); ?></option>
                <template x-for="server in servers" :key="server.id">
                    <option :value="server.id" :selected="String(server.id) === String(serverId)" x-text="server.name"></option>
                </template>
            </select>
            <span class="tw:text-[13px] tw:text-gray-500" x-show="!targetError && !busy.servers && servers.length === 0"><?php echo esc_html__('No servers found for this token.', 'fastcgi-cache-for-ploi'); ?></span>
        </label>

        <label class="tw:flex tw:flex-col tw:gap-1">
            <span class="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-semibold">
                <?php echo esc_html__('Site', 'fastcgi-cache-for-ploi'); ?>
                <span x-show="busy.sites" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
            </span>
            <select class="tw:w-full!" @change="siteId = $event.target.value" :disabled="busy.sites || !serverId || sites.length === 0">
                <option value="" :selected="!siteId"><?php echo esc_html__('— Select a site —', 'fastcgi-cache-for-ploi'); ?></option>
                <template x-for="site in sites" :key="site.id">
                    <option :value="site.id" :selected="String(site.id) === String(siteId)" x-text="site.domain"></option>
                </template>
            </select>
            <span class="tw:text-[13px] tw:text-gray-500" x-show="!serverId"><?php echo esc_html__('Choose a server first.', 'fastcgi-cache-for-ploi'); ?></span>
        </label>
    </div>

    <div class="tw:flex tw:items-center tw:justify-end tw:gap-2">
        <button type="button" class="button" @click="targetModalOpen = false" :disabled="busy.target"><?php echo esc_html__('Cancel', 'fastcgi-cache-for-ploi'); ?></button>
        <button type="button" class="button button-primary" @click="saveTarget()" :disabled="busy.target || !serverId || !siteId">
            <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
                <span x-show="busy.target" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
                <span x-text="busy.target
                    ? '<?php echo esc_js(__('Saving…', 'fastcgi-cache-for-ploi')); ?>'
                    : '<?php echo esc_js(__('Save target', 'fastcgi-cache-for-ploi')); ?>'"></span>
            </span>
        </button>
    </div>
</div>
