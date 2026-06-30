<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Rest;

use FastCgiCacheForPloi\Foundation\Rest\RestController;
use WP_Error;

/**
 * Plugin-side REST base shared by this plugin's controllers.
 *
 * Lives in src/ (NOT foundation/) on purpose: it carries the plugin text domain
 * and the Ploi-specific response contract, neither of which belong in the pure
 * kernel. It centralises the two things more than one controller needs to agree
 * on — the "saved token can't be decrypted, reconnect" error and the
 * upstream-failure HTTP status — so they live in exactly one place.
 */
abstract class PloiRestController extends RestController
{
    /**
     * 502 for Ploi failures with no client-mappable status.
     */
    protected const STATUS_UPSTREAM_FAILURE = 502;

    /**
     * The canonical decrypt-failure -> reconnect error. The code + status are a
     * contract the admin JS keys off (resources/js/settings/store.js), so they
     * must stay in lockstep across every controller that can hit this path —
     * which is exactly why this lives here once.
     */
    protected function reconnectError(): WP_Error
    {
        return $this->error(
            'needs_reconnect',
            __('Your saved token could not be read. Please re-enter your Ploi API token.', 'fastcgi-cache-for-ploi'),
            409
        );
    }

    /**
     * Ploi HTTP statuses that mean the SAVED token itself is the problem — rejected
     * (401) or under-scoped (403). The admin JS routes these to the reconnect
     * banner; every other failure is transient. Surfacing the real status (instead
     * of flattening to {@see self::STATUS_UPSTREAM_FAILURE}) is what lets an action
     * like Flush trigger that banner, exactly like the connection probe does.
     */
    protected function isReconnectStatus(int $status): bool
    {
        return $status === 401 || $status === 403;
    }
}
