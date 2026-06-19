=== FastCGI Cache for Ploi ===
Contributors: filiprimo
Tags: fastcgi-cache, cache, nginx, performance, purge
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 8.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Automatically flush your Ploi-managed site's Nginx FastCGI cache the moment content changes — no manual purging.

== Description ==

FastCGI Cache for Ploi keeps your Ploi-hosted site fast *and* fresh. When you publish or update content, it calls the Ploi API to flush your site's Nginx FastCGI cache automatically, so visitors never see stale pages — and you never have to purge by hand.

**What it does**

* Flushes the FastCGI cache automatically on the events you choose: post publish/update, post deletion, comments, theme switch, Customizer saves, and navigation-menu changes.
* Coalesces bursts of changes into a single flush so a bulk edit doesn't hammer the API.
* One-click **Flush now** button for manual purges.
* A **Recent flushes** log so you can see what triggered each flush and whether it succeeded.
* Stores your Ploi API token encrypted at rest.

**How it works**

Connect the plugin to Ploi with a Ploi API token, pick the server and site to target, and choose which events should trigger a flush. From then on it runs in the background.

This plugin requires a third-party service (the Ploi API) to function — see the *External services* section below.

== External services ==

This plugin connects to the **Ploi API** (https://ploi.io), a third-party service, to flush your site's Nginx FastCGI cache. This connection is required for the plugin to do its job.

**When data is sent to Ploi**

* When you click **Connect** — to validate your token and list your servers.
* When you select a server — to list that server's sites.
* When a flush runs — either automatically (on a content change you enabled) or manually (the **Flush now** button).

**What data is sent to Ploi**

* Your **Ploi API token** — sent as an authorization header on every request.
* The **server ID** and **site ID** you selected — sent in the request URL when listing sites and when flushing.
* The **flush request** itself — an instruction to purge the selected site's FastCGI cache.

No post content, personal data, or visitor information is sent to Ploi. Requests are made to `https://ploi.io/api/...`.

Your use of the Ploi service is governed by Ploi's legal terms:

* Terms of Service: https://ploi.io/terms-of-service
* Privacy Policy: https://ploi.io/privacy-policy

== Source code & build ==

This plugin ships its complete, human-readable source — nothing is obfuscated, and no code is loaded from an external location.

* PHP source: `fastcgi-cache-for-ploi.php`, `uninstall.php`, `src/`, `foundation/`, `modules/`.
* Front-end source: `resources/js/` (JavaScript) and `resources/css/` (CSS).
* Build configuration: `vite.config.js`, `package.json`, `package-lock.json`.

The files in `public/build/` are the minified front-end assets compiled from the source above. To regenerate them:

1. Install Node.js 24 and run `npm install` in the plugin directory.
2. Run `npm run build`. Vite (https://vitejs.dev) bundles `resources/js/admin.js` and `resources/css/admin.css` into `public/build/`.

Bundled and build-time third-party libraries (all GPL-compatible):

* Alpine.js 3 (declared as `^3.14.1`) — MIT — https://alpinejs.dev — bundled into the compiled admin JavaScript.
* Tailwind CSS 4 — MIT — https://tailwindcss.com — used at build time to generate the admin stylesheet.
* Vite 8 — MIT — https://vitejs.dev — the bundler used to produce `public/build/`.

== Installation ==

1. Upload the plugin to `/wp-content/plugins/fastcgi-cache-for-ploi/`, or install it from the **Plugins → Add New** screen in your WordPress admin.
2. Activate the plugin through the **Plugins** menu.
3. Go to **Settings → FastCGI Cache**.
4. Paste a **Ploi API token** (create one at https://ploi.io/profile/api-keys) and click **Connect**. A valid token is saved (encrypted) automatically.
5. Choose the **server** and **site** whose FastCGI cache should be flushed.
6. Pick which **events** should trigger an automatic flush, then click **Save settings**.

**Optional, recommended:** define a dedicated encryption key in `wp-config.php` so the stored token is encrypted with a key independent of your database:

`define( 'FASTCGI_CACHE_FOR_PLOI_KEY', 'a-long-random-string' );`

== Frequently Asked Questions ==

= Do I need a Ploi account? =

Yes. This plugin flushes the FastCGI cache of a site managed by Ploi (https://ploi.io), so you need a Ploi account, a Ploi-managed server/site with FastCGI caching enabled, and a Ploi API token.

= Where do I get a Ploi API token? =

In your Ploi account under **Profile → API keys** (https://ploi.io/profile/api-keys). Create a key, give it a recognizable name (for example "FastCGI Cache — yourdomain.com"), and paste it into the plugin's Connection card.

= A flush fails with an error about caching not being enabled. What's wrong? =

Ploi can only flush FastCGI cache for a site that has it enabled. Enable FastCGI caching for the site in Ploi, then try again.

= Is my API token stored securely? =

Yes. The token is encrypted at rest and is never displayed again after it is saved. For the strongest protection, define `FASTCGI_CACHE_FOR_PLOI_KEY` in `wp-config.php` (see Installation) so the encryption key is independent of your database.

= Can I flush the cache manually? =

Yes — use the **Flush now** button on the settings screen.

= Does it slow down my site? =

No. Flushes happen via a background request to the Ploi API after content changes; they do not block your visitors, and bursts of changes are coalesced into a single flush.

= How do I stop the plugin from contacting Ploi? =

Click **Disconnect** on the settings screen to remove the saved token, or deactivate/uninstall the plugin. With no token saved, the plugin makes no requests to Ploi.

== Screenshots ==

1. The settings screen: connect with a Ploi API token, choose your server and site, pick which events trigger a flush, and review the recent-flushes log.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== Disclaimer ==

Ploi is a trademark of its respective owner. This plugin is not affiliated with or endorsed by Ploi.
