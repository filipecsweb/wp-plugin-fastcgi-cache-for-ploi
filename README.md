# FastCGI Cache for Ploi

Automatically flush a [Ploi](https://ploi.io)-managed site's **FastCGI cache**
whenever your content changes — and flush on demand from a clean settings screen.

Built on **WPForge**, a small, reusable WordPress plugin Foundation (PHP 8.2+,
PSR-11 DI container, attribute-based hooks, vendored Vite enqueuer, opt-in
modules). The Foundation is the product; this plugin is the proof that exercises
every one of its primitives.

---

## What it does

- **Auto-flush on content changes** — post publish/update/status, post delete,
  comment moderation, theme switch, Customizer save, and nav-menu updates. Each
  is an independent toggle.
- **Burst coalescing** — a flurry of changes (bulk edits, autosaves, multiple
  hooks in one request) collapses into a **single** flush via a debounce lock +
  one-off WP-Cron event.
- **Encrypted token at rest** — the Ploi API token is sealed with libsodium; the
  key lives off the database (see [Security](#security)).
- **Live settings screen** — server/site dropdowns populated from the Ploi API,
  "Test connection", manual "Flush now", and a recent-flush log.
- **REST-based admin** — all admin actions go through authenticated REST routes
  (nonce + capability), never `admin-ajax`.

## Requirements

- PHP **8.2+** with the **sodium** extension (bundled in PHP 8.2+)
- WordPress **6.5+**
- A Ploi account and API token
- For development: Composer, Node **24** (see `.nvmrc`), and [Herd](https://herd.laravel.com) + [DBngin](https://dbngin.com)

## How it's built

Three concentric layers, one installable plugin:

| Layer | Path | Namespace | Role |
|------|------|-----------|------|
| **Foundation** (reusable kernel) | `foundation/src/` | `WPForge\` | DI container, attribute hooks, lifecycle, typed Options, dbDelta migrations, HTTP wrapper, security (incl. sodium Crypto), PSR-3 logger, REST base, Vite enqueuer, i18n |
| **admin-ui module** (opt-in) | `modules/admin-ui/src/` | `WPForge\Module\AdminUi\` | Reusable admin-screen machinery (top-level or submenu, screen-scoped assets, Tailwind v4 isolation) |
| **Ploi plugin** (this proof) | `src/` | `Ploi\FastCgiCache\` | Settings, Ploi client, flush engine, event subscriber, REST controllers, flush-log table |

Copying `foundation/` alone gives a clean kernel with **zero modules attached**.
See [`modules/README.md`](modules/README.md) for the module contract and the
catalogue of available / planned modules.

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
4. **Clone this plugin** somewhere outside the site, e.g. `~/dev/ploi-fastcgi-cache`,
   and build it:
   ```bash
   cd ~/dev/ploi-fastcgi-cache
   composer install
   npm install
   npm run build
   ```
5. **Symlink** it into the site's plugins directory:
   ```bash
   ln -s ~/dev/ploi-fastcgi-cache ~/Herd/mysite/wp-content/plugins/ploi-fastcgi-cache
   ```
6. Visit `https://mysite.test/wp-admin/`, activate **FastCGI Cache for Ploi**, then
   open **Settings → FastCGI Cache for Ploi**.
7. *(Recommended)* add a dedicated encryption key to the site's `wp-config.php`
   (see [Security](#security)):
   ```php
   define( 'PLOI_FASTCGI_CACHE_KEY', '<a long random string>' );
   ```

**Hot-reloading the admin UI:** run `npm run dev` — Vite writes a `hot` file into
`public/build/` and the Foundation's enqueuer loads assets from the dev server
(with HMR). Stop it and `npm run build` for production assets.

## Configuration & usage

1. **Paste your Ploi API token** and click **Test connection**. A verified token
   is **encrypted and saved automatically** — it is never shown again, only a
   "token saved" indicator.
2. **Pick a server, then a site** (the site list loads from the chosen server).
3. **Choose which events** trigger an automatic flush, and the **coalesce window**
   (0–60 seconds; `0` = flush as soon as possible, still one flush per burst).
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

The API token is encrypted at rest with libsodium; the key is derived from your
WordPress salts (or a dedicated `PLOI_FASTCGI_CACHE_KEY` constant) and lives on the
**filesystem, not the database**. If the key changes (e.g. salt rotation) the
stored token can no longer be decrypted — the plugin then **clears it and prompts
you to reconnect** rather than erroring. Full details and the recommended
hardening are in [`docs/security.md`](docs/security.md).

## Development & QA

```bash
composer cs      # PHPCS — PSR-12 formatting + WordPress security/correctness sniffs
composer stan    # PHPStan at max level (with WordPress stubs)
composer test    # Pest unit suite (Brain Monkey)
composer qa      # all three

npm run build    # production assets
npm run dev      # Vite dev server (HMR)
npm run e2e      # Playwright E2E (requires a running wp-env — see below)
```

**E2E with wp-env:**

```bash
npx wp-env start
npm run e2e
npx wp-env stop
```

All of the above run in CI (`.github/workflows/ci.yml`) across PHP 8.2/8.3/8.4.

## Project layout

```
foundation/src/        WPForge kernel (reusable)
modules/admin-ui/src/  admin-ui module (opt-in)
src/                   FastCGI Cache for Ploi plugin code
resources/             Alpine + Tailwind v4 sources (built into public/build/)
tests/Unit/            Pest unit tests
tests/e2e/             Playwright E2E
docs/security.md       Encryption key management & residual risk
ploi-fastcgi-cache.php Plugin bootstrap (version = single source of truth)
uninstall.php          Drops the table + options on uninstall
```

## License

GPL-2.0-or-later.
