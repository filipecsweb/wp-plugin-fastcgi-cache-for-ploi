import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from './tests/e2e/support/load-env.js'

// Load .claude/.env (WP-under-test URL, admin creds, path prefix, Ploi tokens) so
// `npm run e2e` works without sourcing it by hand. Already-set env values win.
loadEnv()

/**
 * E2E against a real WordPress that serves this checkout and talks to the real Ploi
 * API. Configure everything in `.claude/.env` (loaded above): WP_BASE_URL,
 * WP_PATH_PREFIX, WP_ADMIN_USER, WP_ADMIN_PASS, WP_PLUGIN_PATH, and the
 * PLOI_API_TOKEN_* tokens (the good one plus the bad/under-scoped ones). global-setup
 * refuses to run unless WP_PLUGIN_PATH resolves to this repo, so the suite can't
 * silently test a stale copy.
 *
 * The specs drive the BUILT admin JS, so run `npm run build` after changing
 * resources/js before re-running (and `npm run e2e:install` once for the browsers).
 *
 * Runs SERIALLY on purpose: every spec shares one WordPress install (one settings
 * option row + one flush-log table), so parallel workers would clobber each other's
 * saved connection/target. Each spec restores the baseline, so serial order keeps
 * them independent without cross-test races. The specs also make real Ploi API
 * calls, hence the generous timeouts.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.WP_BASE_URL || 'http://localhost:8888',
    trace: 'on-first-retry',
    // Local test sites (Herd/Valet) serve HTTPS with a locally-trusted CA the
    // bundled browser doesn't know about.
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
