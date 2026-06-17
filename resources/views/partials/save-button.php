<?php

/**
 * The "Save settings" button, rendered at the bottom of each Settings-tab card.
 * Every instance calls the same `save()` on the shared `ploiCache` Alpine root
 * (see settings.php), so it persists ALL settings in one REST call regardless of
 * which card it sits under. Defined once here to keep its classes/bindings a
 * single source of truth.
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<button type="button" class="button button-primary" @click="save()" :disabled="busy.save || !debounceValid">
    <span class="tw:inline-flex tw:items-center tw:gap-2 tw:align-middle">
        <span x-show="busy.save" class="tw:inline-block tw:box-border tw:h-3.5 tw:w-3.5 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"></span>
        <span x-text="busy.save
            ? '<?php echo esc_js(__('Saving…', 'fastcgi-cache-for-ploi')); ?>'
            : '<?php echo esc_js(__('Save settings', 'fastcgi-cache-for-ploi')); ?>'"></span>
    </span>
</button>
