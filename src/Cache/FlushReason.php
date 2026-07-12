<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Cache;

/**
 * Why a flush happened, and the single source of truth for which auto-flush
 * events exist. The six auto cases (everything except Manual, exposed by
 * autoCases()) define the canonical event keys + labels that FlushEvents derives
 * from; Manual is the "Flush now" button and has no FlushEvents toggle.
 *
 * @since 1.0.0
 */
enum FlushReason: string
{
    /**
     * @since 1.0.0
     */
    case PostSave   = 'post_save';
    /**
     * @since 1.0.0
     */
    case PostDelete = 'post_delete';
    /**
     * @since 1.0.0
     */
    case Comment    = 'comment';
    /**
     * @since 1.0.0
     */
    case Theme      = 'theme';
    /**
     * @since 1.0.0
     */
    case Customizer = 'customizer';
    /**
     * @since 1.0.0
     */
    case Menu       = 'menu';
    /**
     * @since 1.0.0
     */
    case Manual     = 'manual';

    /**
     * Canonical event-key source FlushEvents reads from, so keys can't drift from
     * the enum.
     *
     * @since 1.0.0
     *
     * @return list<self>
     */
    public static function autoCases(): array
    {
        return array_values(array_filter(
            self::cases(),
            static fn (self $case): bool => $case !== self::Manual,
        ));
    }

    /**
     * @since 1.0.0
     */
    public function label(): string
    {
        return match ($this) {
            self::PostSave   => __('Post published or updated', 'fastcgi-cache-for-ploi'),
            self::PostDelete => __('Post deleted', 'fastcgi-cache-for-ploi'),
            self::Comment    => __('Comment posted or moderated', 'fastcgi-cache-for-ploi'),
            self::Theme      => __('Theme switched', 'fastcgi-cache-for-ploi'),
            self::Customizer => __('Customizer changes published', 'fastcgi-cache-for-ploi'),
            self::Menu       => __('Navigation menu updated', 'fastcgi-cache-for-ploi'),
            self::Manual     => __('Manual flush', 'fastcgi-cache-for-ploi'),
        };
    }
}
