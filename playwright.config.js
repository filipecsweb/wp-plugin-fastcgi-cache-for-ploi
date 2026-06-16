import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Auto-load .claude/.env (gitignored — WP-under-test URL, admin creds, path
// prefix, Ploi tokens) so `npm run e2e` works without sourcing it by hand.
// Already-set environment values win, so CI / explicit overrides still apply.
const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.claude/.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim()
    const eq = line.indexOf('=')
    if (!trimmed || trimmed.startsWith('#') || eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (/^[A-Z_][A-Z0-9_]*$/.test(key) && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

/**
 * E2E against a real WordPress. Set WP_BASE_URL (or put it in .claude/.env, which
 * is auto-loaded above). For Bedrock-style installs that serve wp-admin under a
 * subdir, set WP_PATH_PREFIX=/wp. The global setup refuses to run unless
 * WP_PLUGIN_PATH resolves to this checkout, so the suite can't test a stale copy.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI serves ONE WordPress (shared option row + flush-log table), so run serially
  // there to avoid cross-test state races; locally, parallelise across cores.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.WP_BASE_URL || 'http://localhost:8888',
    trace: 'on-first-retry',
    // Local test sites (Herd/Valet) serve HTTPS with a locally-trusted CA that
    // the bundled browser doesn't know about.
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
