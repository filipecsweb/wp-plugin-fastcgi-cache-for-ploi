<?php

/**
 * Reusable toast host: a fixed, stacked region that renders the global toast
 * store. Drop once inside any Alpine root and raise toasts from anywhere via
 * $store.toasts.add(type, text). Mirrors modal.php's reuse pattern.
 *
 * CONTRACT: requires the 'toasts' Alpine store (registered in admin.js).
 *
 * @var \FastCgiCacheForPloi\Admin\SettingsPage $this
 */

declare(strict_types=1);

defined('ABSPATH') || exit;
?>
<div class="tw:fixed tw:bottom-4 tw:right-4 tw:z-[100000] tw:flex tw:w-80 tw:max-w-[calc(100vw-2rem)] tw:flex-col tw:gap-2">
    <template x-for="toast in $store.toasts.items" :key="toast.id">
        <div
            class="notice inline is-dismissible tw:relative tw:m-0! tw:shadow-lg"
            :class="toast.type === 'success' ? 'notice-success' : toast.type === 'warning' ? 'notice-warning' : toast.type === 'info' ? 'notice-info' : 'notice-error'"
            :role="toast.type === 'success' || toast.type === 'info' ? 'status' : 'alert'"
            :aria-live="toast.type === 'success' || toast.type === 'info' ? 'polite' : 'assertive'"
            x-transition:enter="tw:transition tw:duration-200 tw:ease-out"
            x-transition:enter-start="tw:translate-x-4 tw:opacity-0"
            x-transition:enter-end="tw:translate-x-0 tw:opacity-100"
            x-transition:leave="tw:transition tw:duration-150 tw:ease-in"
            x-transition:leave-start="tw:translate-x-0 tw:opacity-100"
            x-transition:leave-end="tw:translate-x-4 tw:opacity-0"
        >
            <p x-text="toast.text"></p>
            <button
                type="button"
                class="notice-dismiss tw:top-1! tw:right-1! tw:flex! tw:h-[34px]! tw:w-[34px]! tw:items-center! tw:justify-center! tw:p-0!"
                x-show="toast.dismissible"
                @click="$store.toasts.remove(toast.id)"
            >
                <svg
                    x-show="toast.timeout > 0"
                    aria-hidden="true"
                    viewBox="0 0 34 34"
                    class="tw:pointer-events-none tw:absolute tw:inset-0 tw:h-full tw:w-full"
                    :class="toast.type === 'success' ? 'tw:text-green-600' : toast.type === 'warning' ? 'tw:text-amber-500' : toast.type === 'info' ? 'tw:text-blue-500' : 'tw:text-red-600'"
                >
                    <circle cx="17" cy="17" r="14" fill="none" stroke="currentColor" stroke-width="2.5" class="tw:opacity-20"></circle>
                    <circle
                        cx="17" cy="17" r="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                        transform="rotate(-90 17 17)"
                        pathLength="100" stroke-dasharray="100"
                        :stroke-dashoffset="100 - toast.progress"
                    ></circle>
                </svg>
                <span class="screen-reader-text"><?php echo esc_html__('Dismiss this notice.', 'fastcgi-cache-for-ploi'); ?></span>
            </button>
        </div>
    </template>
</div>
