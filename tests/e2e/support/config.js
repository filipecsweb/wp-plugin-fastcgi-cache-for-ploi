/**
 * Env-derived configuration for the e2e suite. Everything sensitive or
 * environment-specific is read from `.claude/.env` BY KEY here, so no spec ever
 * hardcodes a URL, credential, or token. loadEnv() must have run first (the
 * Playwright config calls it at import time; global-setup re-calls it defensively).
 */
const WP_PREFIX = process.env.WP_PATH_PREFIX || ''

export const LOGIN_PATH = `${WP_PREFIX}/wp-login.php`
export const SETTINGS_PATH = `${WP_PREFIX}/wp-admin/options-general.php?page=fastcgi-cache-for-ploi`
export const PLUGINS_PATH = `${WP_PREFIX}/wp-admin/plugins.php`

export const ADMIN = {
  login: process.env.WP_ADMIN_USER || '',
  pass: process.env.WP_ADMIN_PASS || '',
}

/**
 * Ploi test tokens, by scope (defined in `.claude/.env`). Any may be absent — the
 * token-dependent specs skip cleanly rather than fail when their token is missing.
 */
export const TOKENS = {
  good: process.env.PLOI_API_TOKEN_GOOD_READ_SERVERS_AND_READ_SITES_SCOPE,
  serversOnly: process.env.PLOI_API_TOKEN_BAD_ONLY_READ_SERVERS_SCOPE,
  sitesOnly: process.env.PLOI_API_TOKEN_BAD_ONLY_READ_SITES_SCOPE,
  noScope: process.env.PLOI_API_TOKEN_BAD_NO_SCOPE_AT_ALL,
}

/**
 * Route-mock globs for the deleted-target specs. The plugin's REST routes live under
 * a fixed namespace; the browser fetches them at `{site}/wp-json/<namespace>/<route>`.
 * These globs match the UI's own fetch() calls. They do NOT match page.request (the
 * harness's REST client), which bypasses page.route — so a spec can mock the UI while
 * the harness still reads/writes real state.
 */
// NS mirrors the PHP source of truth (RestServiceProvider::NAMESPACE); any drift
// is caught by these mocks no longer matching, which fails the mocked specs.
const NS = 'fastcgi-cache-for-ploi/v1'
export const MOCK = {
  connection: `**/${NS}/connection`,
  sites: `**/${NS}/servers/*/sites`,
  flush: `**/${NS}/flush`,
  log: `**/${NS}/log`,
}
