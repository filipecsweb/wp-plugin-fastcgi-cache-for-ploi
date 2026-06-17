import { test as base, expect } from '@playwright/test'
import { E2E_SUBSCRIBER, wp, wpAvailable, wpTry } from './wp-cli.js'

// Shared test base: defines login/REST/state-reset once so specs can't drift;
// rest fixture auto-resets connection per test.

const WP_PREFIX = process.env.WP_PATH_PREFIX || ''
const ADMIN = { login: process.env.WP_ADMIN_USER || 'admin', pass: process.env.WP_ADMIN_PASS || 'password' }

export const LOGIN_PATH = `${WP_PREFIX}/wp-login.php`
export const SETTINGS_PATH = `${WP_PREFIX}/wp-admin/options-general.php?page=fastcgi-cache-for-ploi`

async function loginAs(page, { login, pass }) {
  await page.goto(LOGIN_PATH)
  await page.fill('#user_login', login)
  await page.fill('#user_pass', pass)
  await page.click('#wp-submit')
  await expect(page).toHaveURL(/wp-admin/)
}

export class RestClient {
  constructor(page, restUrl, nonce) {
    this.page = page
    this.restUrl = restUrl
    this.nonce = nonce
  }

  static async forPage(page) {
    const cfg = await page.evaluate(() => ({
      restUrl: window.PloiCacheConfig.restUrl,
      nonce: window.PloiCacheConfig.nonce,
    }))
    return new RestClient(page, cfg.restUrl, cfg.nonce)
  }

  request(method, routePath, body) {
    return this.page.request[method](`${this.restUrl}${routePath}`, {
      headers: { 'X-WP-Nonce': this.nonce, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { data: body } : {}),
    })
  }

  async settings() {
    return (await this.request('get', '/settings')).json()
  }

  async save(payload) {
    const res = await this.request('post', '/settings', payload)
    expect(res.ok()).toBeTruthy()
    return res.json()
  }

  /** Seed a connected state WITHOUT contacting Ploi (token persisted as-is). */
  async seed(overrides = {}) {
    return this.save({
      token: 'seed-token-e2e',
      server_id: '7',
      site_id: '42',
      server_name: 'Seed Server',
      site_domain: 'seed.example',
      events: { post_save: true, menu: true },
      debounce: 12,
      ...overrides,
    })
  }

  reset() {
    return this.request('delete', '/connection')
  }

  async log() {
    return (await this.request('get', '/log')).json()
  }
}

export const test = base.extend({
  admin: async ({ page }, use) => {
    await loginAs(page, ADMIN)
    await page.goto(SETTINGS_PATH)
    await use(page)
  },

  rest: async ({ admin }, use) => {
    const client = await RestClient.forPage(admin)
    await use(client)
    // Leave the saved connection clean for the next test (idempotent).
    await client.reset().catch(() => {})
  },

  subscriber: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, E2E_SUBSCRIBER)
    await use(page)
    await context.close()
  },
})

export { expect, E2E_SUBSCRIBER, wp, wpAvailable, wpTry }
