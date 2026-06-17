# Security notes — FastCGI Cache for Ploi

## Why the API token is sensitive

A Ploi API token grants broad control over the connected server and sites
(deployments, SSL, services, file access). Treat it like a server credential:
its compromise is closer to "root on the box" than "a leaked app password". The
plugin therefore stores it **encrypted at rest** and keeps the encryption key
**off the database**.

## Encryption at rest

Tokens are sealed with libsodium authenticated encryption
(`sodium_crypto_secretbox`, XSalsa20-Poly1305) via the Foundation's
`WPForge\Security\Crypto` primitive:

- A random 24-byte nonce per encryption (never reused).
- Ciphertext is stored as `wpf:sb1:` + base64(`nonce` ‖ `ciphertext`).
- Decryption is **total**: any failure (tampering, truncation, wrong key,
  rotated salts) returns `null` and never throws or fatals.

## Where the key lives — and the residual risk

The key is **derived from the site's WordPress salts**
(`wp_salt('secure_auth') . wp_salt('auth')`, hashed to 32 bytes), unless a
dedicated key constant is provided.

| Scenario | Key material location | DB-dump-alone decrypts token? |
|---|---|---|
| `FASTCGI_CACHE_FOR_PLOI_KEY` defined in `wp-config.php` (recommended) | `wp-config.php` (filesystem) | **No** |
| `AUTH_KEY`/`SECURE_AUTH_KEY` defined in `wp-config.php` (Ploi default) | `wp-config.php` (filesystem) | **No** |
| Salt constants absent (non-standard install) | auto-generated salts in `wp_options` | **Yes — avoid** |

**On a Ploi-provisioned site the salt constants are always written to
`wp-config.php`, so the key sits on the filesystem and a database dump alone
cannot recover the token.** The only at-risk configuration is a non-standard
install with no salt constants, where WordPress falls back to DB-stored salts.

### Hardening (recommended)

Define a dedicated key in `wp-config.php`:

```php
define( 'FASTCGI_CACHE_FOR_PLOI_KEY', '<a long random string>' );
```

This guarantees the key is filesystem-only **and** decouples the token from
login-salt rotation (rotating `AUTH_KEY` to invalidate sessions will no longer
invalidate the stored token).

### Plugin behaviour

- `Crypto` is bound to prefer `FASTCGI_CACHE_FOR_PLOI_KEY`, then fall back to
  `wp_salt()`.
- If the key changes (salt rotation) and the stored token can no longer be
  decrypted, the plugin clears the token and prompts the operator to reconnect —
  no white screen.
- When the token would be DB-decryptable — no dedicated `FASTCGI_CACHE_FOR_PLOI_KEY`
  and the WP salts not pinned in `wp-config.php` (so `wp_salt()` sources them from
  the database) — the settings screen shows a non-blocking warning recommending the
  hardening above. A standard install with real salts is safe and sees nothing.

## Transport & access control

- All admin operations go through authenticated REST routes
  (`register_rest_route`) guarded by **both** the `wp_rest` nonce
  (`X-WP-Nonce`) **and** a `manage_options` capability check.
- The token is never returned to the browser after it is saved; the settings
  screen only reports whether a token is present.
- Outbound calls to the Ploi API use `wp_remote_*` over HTTPS with a Bearer
  token and a bounded timeout.
