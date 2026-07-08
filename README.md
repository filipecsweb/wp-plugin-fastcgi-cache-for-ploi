# FastCGI Cache for Ploi

Automatically flush a [Ploi](https://ploi.io)-managed site's **FastCGI cache**
whenever your content changes — and flush on demand from a clean settings screen.

Built on a small, reusable WordPress plugin **Foundation** (PHP 8.2+,
PSR-11 DI container, attribute-based hooks, vendored Vite enqueuer, opt-in
modules). The Foundation is the product; this plugin is the proof that exercises
every one of its primitives.

---

## What it does

- **Auto-flush on content changes** — post publish/update/status, post delete,
  comment moderation, theme switch, Customizer save, and nav-menu updates. Each
  is an independent toggle.
- **Burst coalescing** — a flurry of changes (bulk edits, autosaves, multiple
  hooks in one request) collapses into a **single** flush via a coalescing lock +
  one-off WP-Cron event.
- **Encrypted token at rest** — the Ploi API token is sealed with libsodium; the
  key lives off the database (see [Security](#security)).
- **Live settings screen** — server/site dropdowns populated from the Ploi API,
  one-click Connect/Disconnect, manual "Flush now", and a recent-flush log.
- **REST-based admin** — all admin actions go through authenticated REST routes
  (nonce + capability), never `admin-ajax`.

## Requirements

- PHP **8.2+** with the **sodium** extension (bundled in PHP 8.2+)
- WordPress **6.5+**
- A Ploi account and API token
- For development: Composer, Node (the version pinned in `.nvmrc`), and [Herd](https://herd.laravel.com) + [DBngin](https://dbngin.com)

## Installation

The plugin ships compiled, but the build artifacts (`public/build/`) and Composer
dependencies are not committed — build them once:

```bash
composer install --no-dev   # production autoloader (omit --no-dev for tooling)
npm ci
npm run build               # emits public/build/.vite/manifest.json + hashed assets
```

Then copy/symlink the plugin folder into your site's `wp-content/plugins/` and
activate it.

### Local development with Herd + DBngin

1. **Install** [Herd](https://herd.laravel.com) (serves PHP/WordPress) and
   [DBngin](https://dbngin.com) (local MySQL).
2. In **DBngin**, start a MySQL instance (default port `3306`).
3. **Create a WordPress site** under Herd's sites directory, e.g. `~/Herd/mysite`,
   and point its `wp-config.php` at the DBngin database.
4. **Clone this plugin** somewhere outside the site, e.g. `~/dev/fastcgi-cache-for-ploi`,
   and build it:
   ```bash
   cd ~/dev/fastcgi-cache-for-ploi
   composer install
   npm install
   npm run build
   ```
5. **Symlink** it into the site's plugins directory:
   ```bash
   ln -s ~/dev/fastcgi-cache-for-ploi ~/Herd/mysite/wp-content/plugins/fastcgi-cache-for-ploi
   ```
6. Visit `https://mysite.test/wp-admin/`, activate **FastCGI Cache for Ploi**, then
   open **Settings → FastCGI Cache**.
7. *(Recommended)* add a dedicated encryption key to the site's `wp-config.php`
   (see [Security](#security)):
   ```php
   define( 'FASTCGI_CACHE_FOR_PLOI_KEY', '<a long random string>' );
   ```

**Hot-reloading the admin UI:** run `npm run dev` — Vite writes a `hot` file into
`public/build/` and the Foundation's enqueuer loads assets from the dev server
(with HMR). Stop it and `npm run build` for production assets.

## Configuration & usage

1. **Paste your Ploi API token** and click **Connect**. A verified token
   is **encrypted and saved automatically** — it is never shown again; the field
   locks and the button becomes **Disconnect**.
2. **Pick a server, then a site** in the **Select target** dialog (the site list
   loads from the chosen server).
3. **Choose which events** trigger an automatic flush; bursts are coalesced into a
   single flush automatically.
4. **Save settings.** Use **Flush now** any time, and watch the **Recent flushes**
   log (when, trigger, target, status + HTTP code, duration).

### How auto-flush maps to WordPress hooks

| Toggle | WordPress hooks |
|--------|-----------------|
| Post published or updated | `save_post`, `transition_post_status` |
| Post deleted | `deleted_post` |
| Comment posted or moderated | `comment_post`, `transition_comment_status`, `edit_comment` |
| Theme switched | `switch_theme` |
| Customizer changes published | `customize_save_after` |
| Navigation menu updated | `wp_update_nav_menu` |

Every hook is gated by its toggle — turning a toggle off stops a flush from **all**
of its underlying hooks. Until a token + server + site are configured, auto-flush
is a silent no-op (never an error).

## Security

The API token is encrypted at rest with libsodium. The key comes from a dedicated
`FASTCGI_CACHE_FOR_PLOI_KEY` constant, or falls back to your WordPress salts — and when
those are pinned in `wp-config.php` (the standard and Ploi-provisioned case) the key
lives on the **filesystem, not the database**. The one at-risk case is a non-standard
install with DB-stored salts, which the settings screen warns about. If the key changes
(e.g. salt rotation) the stored token can no longer be decrypted — the plugin then
**clears it and prompts you to reconnect** rather than erroring. Full details and the
recommended hardening are in [`docs/security.md`](docs/security.md).

## Development & QA

```bash
composer cs      # PHPCS — PSR-12 + WordPress sniffs (not a substitute for Plugin Check)
composer stan    # PHPStan at max level (with WordPress stubs)
composer test    # Pest unit suite (Brain Monkey)
composer qa      # all three

npm run build    # production assets
npm run dev      # Vite dev server (HMR)
npm run e2e      # Playwright E2E against a real WordPress (see below)
```

**E2E (Playwright against a real WordPress):**

The suite drives an actual WordPress install — not a bundled container. Point it at
a local site (Herd/Valet, or any WordPress) that serves *this* checkout, then run
Playwright. Copy `.claude/.env.example` to `.claude/.env` (auto-loaded) and set:

```bash
WP_BASE_URL=https://your-site.test        # the WordPress under test
WP_ADMIN_USER=admin                       # an admin login
WP_ADMIN_PASS=password
WP_PLUGIN_PATH=/abs/path/to/site/wp-content/plugins/fastcgi-cache-for-ploi
                                          # symlink to this checkout; the preflight
                                          # refuses to run against a stale copy

npm run e2e
```

CI provisions its own WordPress from scratch with WP-CLI (`wp core download/install`
+ a symlinked plugin + the PHP built-in server) — see `.github/workflows/ci.yml`.
The full quality gate (`composer qa` across PHP 8.2/8.3/8.4, asset build, and this
E2E job) runs there on every push.

## License

GPL-2.0-or-later.

Ploi is a trademark of its respective owner. This plugin is not affiliated with or
endorsed by Ploi.
