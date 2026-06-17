<?php

/**
 * Reusable modal shell. Visibility is driven by a boolean Alpine expression in the
 * ambient component; the body is a named partial, so any screen reuses the shell
 * with its own content and trigger.
 *
 * CONTRACT: render inside an Alpine x-data root; $state must be a boolean property
 * on it, and $titleId must be unique on the page.
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 * @var string $state    Boolean Alpine expression toggling the modal (e.g. 'targetModalOpen').
 * @var string $title    Heading text.
 * @var string $titleId  id wiring aria-labelledby to the heading.
 * @var string $body     Partial name rendered inside the dialog body.
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div
    x-show="<?php echo $state; ?>"
    x-cloak
    @keydown.escape.window="<?php echo $state; ?> = false"
    class="tw:fixed tw:inset-0 tw:z-[100000] tw:flex tw:items-center tw:justify-center tw:bg-black/50 tw:p-4"
    style="display: none;"
>
    <div
        @click.outside="<?php echo $state; ?> = false"
        x-effect="<?php echo $state; ?> && $nextTick(() => $el.querySelector('select, input, button')?.focus())"
        role="dialog"
        aria-modal="true"
        aria-labelledby="<?php echo esc_attr($titleId); ?>"
        class="tw:w-full tw:max-w-lg tw:rounded-lg tw:bg-white tw:shadow-2xl"
    >
        <div class="tw:flex tw:items-center tw:justify-between tw:gap-4 tw:border-b tw:border-gray-200 tw:px-4 tw:py-3">
            <h2 id="<?php echo esc_attr($titleId); ?>" class="tw:m-0! tw:text-sm! tw:font-semibold"><?php echo esc_html($title); ?></h2>
            <button
                type="button"
                class="button-link tw:text-gray-500!"
                @click="<?php echo $state; ?> = false"
                aria-label="<?php echo esc_attr__('Close', 'fastcgi-cache-for-ploi'); ?>"
            ><span aria-hidden="true" class="tw:text-lg">&times;</span></button>
        </div>
        <div class="tw:p-4">
            <?php $this->partial($body); ?>
        </div>
    </div>
</div>
