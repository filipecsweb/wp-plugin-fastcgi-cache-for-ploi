<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Cache;

/**
 * Why a flush happened. The six auto cases share their string value with the
 * matching FlushEvents toggle key; Manual is the "Flush now" button.
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

    public function label(): string
    {
        return match ($this) {
            self::PostSave   => __('Post published or updated', 'ploi-fastcgi-cache'),
            self::PostDelete => __('Post deleted', 'ploi-fastcgi-cache'),
            self::Comment    => __('Comment posted or moderated', 'ploi-fastcgi-cache'),
            self::Theme      => __('Theme switched', 'ploi-fastcgi-cache'),
            self::Customizer => __('Customizer changes published', 'ploi-fastcgi-cache'),
            self::Menu       => __('Navigation menu updated', 'ploi-fastcgi-cache'),
            self::Manual     => __('Manual flush', 'ploi-fastcgi-cache'),
        };
    }
}
