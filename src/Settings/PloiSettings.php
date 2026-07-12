<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Settings;

use FastCgiCacheForPloi\Cache\FlushEvents;
use FastCgiCacheForPloi\Foundation\Security\Crypto;
use FastCgiCacheForPloi\Foundation\Settings\Options;

/**
 * Typed settings for the plugin, layered over the Foundation Options + Crypto.
 *
 * Token handling: the token is stored encrypted. token() decrypts
 * it; if decryption fails (e.g. the WordPress salts were rotated), the stored
 * value is cleared and a "needs reconnect" flag is raised, and null is returned —
 * never an exception. Callers surface the reconnect prompt instead of erroring.
 *
 * @since 1.0.0
 */
final class PloiSettings
{
    private const KEY_TOKEN       = 'token';
    private const KEY_SERVER_ID   = 'server_id';
    private const KEY_SERVER_NAME = 'server_name';
    private const KEY_SITE_ID     = 'site_id';
    private const KEY_SITE_DOMAIN = 'site_domain';
    private const KEY_EVENTS      = 'events';
    private const KEY_RECONNECT   = 'needs_reconnect';

    private bool $tokenLoaded = false;
    private ?string $tokenPlain = null;

    public function __construct(
        private readonly Options $options,
        private readonly Crypto $crypto,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            self::KEY_EVENTS => FlushEvents::defaults(),
        ];
    }

    public function token(): ?string
    {
        if ($this->tokenLoaded) {
            return $this->tokenPlain;
        }

        $this->tokenLoaded = true;
        $stored            = $this->options->getString(self::KEY_TOKEN, '');

        if ($stored === '') {
            return $this->tokenPlain = null;
        }

        $plain = $this->crypto->decrypt($stored);

        if ($plain === null) {
            // Decrypt failure usually means rotated WP salts; recover by clearing + flagging reconnect.
            $this->options->forget(self::KEY_TOKEN);
            $this->options->set(self::KEY_RECONNECT, true);

            return $this->tokenPlain = null;
        }

        return $this->tokenPlain = $plain;
    }

    public function setToken(string $plain): void
    {
        $this->options->fill([
            self::KEY_TOKEN     => $this->crypto->encrypt($plain),
            self::KEY_RECONNECT => false,
        ]);

        $this->tokenLoaded = true;
        $this->tokenPlain  = $plain;
    }

    /**
     * Cheap presence check (no decryption) for hot-path auto-flush gating.
     */
    public function hasStoredToken(): bool
    {
        return $this->options->getString(self::KEY_TOKEN, '') !== '';
    }

    public function hasToken(): bool
    {
        return $this->token() !== null;
    }

    public function needsReconnect(): bool
    {
        return $this->options->getBool(self::KEY_RECONNECT, false);
    }

    /**
     * Tear down the saved connection: delete the encrypted token and the saved
     * target, and clear the reconnect flag. A deliberate disconnect lands in a
     * clean "no token" state — NOT the decrypt-failure "needs reconnect" state —
     * so the reconnect flag is reset rather than raised. Event toggles are a user
     * preference and are deliberately preserved.
     */
    public function disconnect(): void
    {
        $this->options->fill(self::blankTarget() + [self::KEY_RECONNECT => false]);

        $this->options->forget(self::KEY_TOKEN);

        $this->tokenLoaded = true;
        $this->tokenPlain  = null;
    }

    public function serverId(): string
    {
        return $this->options->getString(self::KEY_SERVER_ID, '');
    }

    public function serverName(): string
    {
        return $this->options->getString(self::KEY_SERVER_NAME, '');
    }

    public function siteId(): string
    {
        return $this->options->getString(self::KEY_SITE_ID, '');
    }

    public function siteDomain(): string
    {
        return $this->options->getString(self::KEY_SITE_DOMAIN, '');
    }

    public function setTarget(string $serverId, string $siteId, string $serverName = '', string $siteDomain = ''): void
    {
        $this->options->fill([
            self::KEY_SERVER_ID   => $serverId,
            self::KEY_SITE_ID     => $siteId,
            self::KEY_SERVER_NAME => $serverName,
            self::KEY_SITE_DOMAIN => $siteDomain,
        ]);
    }

    /**
     * @return array<string, string>
     */
    private static function blankTarget(): array
    {
        return [
            self::KEY_SERVER_ID   => '',
            self::KEY_SERVER_NAME => '',
            self::KEY_SITE_ID     => '',
            self::KEY_SITE_DOMAIN => '',
        ];
    }

    /**
     * @return array<string, bool>
     */
    public function events(): array
    {
        $stored = $this->options->getArray(self::KEY_EVENTS, FlushEvents::defaults());
        $events = FlushEvents::defaults();

        foreach ($events as $key => $default) {
            if (array_key_exists($key, $stored)) {
                $events[$key] = (bool) $stored[$key];
            }
        }

        return $events;
    }

    public function isEventEnabled(string $key): bool
    {
        return $this->events()[$key] ?? false;
    }

    /**
     * @param array<array-key, mixed> $events
     */
    public function setEvents(array $events): void
    {
        $clean = [];

        foreach (FlushEvents::keys() as $key) {
            $clean[$key] = ! empty($events[$key]);
        }

        $this->options->set(self::KEY_EVENTS, $clean);
    }

    /**
     * Full readiness check; decrypts the token (not for hot paths).
     */
    public function isConfigured(): bool
    {
        return $this->hasToken() && $this->serverId() !== '' && $this->siteId() !== '';
    }

    /**
     * Hot-path readiness check; avoids decryption.
     */
    public function isReadyForAutoFlush(): bool
    {
        return $this->hasStoredToken()
            && ! $this->needsReconnect()
            && $this->serverId() !== ''
            && $this->siteId() !== '';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'hasToken'       => $this->hasToken(),
            'needsReconnect' => $this->needsReconnect(),
            'serverId'       => $this->serverId(),
            'serverName'     => $this->serverName(),
            'siteId'         => $this->siteId(),
            'siteDomain'     => $this->siteDomain(),
            'enabledEvents'  => $this->events(),
            'isConfigured'   => $this->isConfigured(),
        ];
    }
}
