<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Cache;

/**
 * Why a flush happened, and the single source of truth for which auto-flush
 * events exist. The six auto cases (everything except Manual, exposed by
 * autoCases()) define the canonical event keys + labels that FlushEvents derives
 * from; Manual is the "Flush now" button and has no FlushEvents toggle.
 */
enum FlushReason: string
{
    case PostSave   = 'post_save';
    case PostDelete = 'post_delete';
    case Comment    = 'comment';
    case Theme      = 'theme';
    case Customizer = 'customizer';
    case Menu       = 'menu';
    case Manual     = 'manual';

    /**
     * The content-change cases that map to a FlushEvents toggle — every case
     * except Manual. The canonical list FlushEvents reads from, so the event
     * keys can never drift from the enum.
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
