import { expect } from '@playwright/test'
import { NS, TOKENS } from './config.js'

/**
 * The canonical baseline flush target, resolved once per worker from the live Ploi
 * account (first server that has a site) and reused for the rest of the run. Kept at
 * module scope (not per-Api-instance) so it survives across tests: a spec that points
 * the saved target at bogus IDs (F4) can still be restored to a known-good target in
 * teardown, instead of the harness adopting the bogus target as "configured".
 */
let canonicalTarget = null

/**
 * REST client for the plugin's own routes, used by specs to set up / tear down /
 * assert state out-of-band. Built on page.request, which shares the browser's auth
 * cookies (we add the wp_rest nonce) but is NOT intercepted by page.route — so this
 * stays REAL even while a spec mocks the UI's fetches.
 */
export class Api {
  constructor(page, root, nonce) {
    this.page = page
    this.root = root
    this.nonce = nonce
  }

  /**
   * The REST root and the wp_rest nonce come from core's own apiFetch bootstrap (the
   * wp-api-fetch inline script), the source the screen's requests use; the plugin's
   * config carries neither.
   */
  static async forPage(page) {
    const { root, nonce } = await page.evaluate(() => ({
      root: /createRootURLMiddleware\(\s*"([^"]*)"/.exec(document.getElementById('wp-api-fetch-js-after')?.textContent ?? '')?.[1],
      nonce: window.wp?.apiFetch?.nonceMiddleware?.nonce,
    }))
    if (!root || !nonce) throw new Error('[e2e] wp-api-fetch is not bootstrapped on this page.')
    return new Api(page, root, nonce)
  }

  req(method, routePath, body, namespace = NS) {
    return this.page.request[method](`${this.root}${namespace}${routePath}`, {
      headers: { 'X-WP-Nonce': this.nonce, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { data: body } : {}),
    })
  }

  /** The admin user's own locale ('' = the site default). Core rejects a locale whose language pack isn't installed. */
  async setUserLocale(locale) {
    const res = await this.req('post', '/users/me', { locale }, 'wp/v2')
    expect(res.ok(), `set the user locale to "${locale}" (wp language core install ${locale})`).toBeTruthy()
  }

  async settings() {
    const res = await this.req('get', '/settings')
    expect(res.ok(), 'GET /settings').toBeTruthy()
    return res.json()
  }

  connectRaw(token) {
    return this.req('post', '/connection', { token })
  }

  disconnect() {
    return this.req('delete', '/connection')
  }

  probe() {
    return this.req('get', '/connection').then((r) => r.json())
  }

  log() {
    return this.req('get', '/log').then((r) => r.json())
  }

  async setTarget(target) {
    const res = await this.req('post', '/target', target)
    expect(res.ok(), 'POST /target').toBeTruthy()
    return res.json()
  }

  async setEvents(events) {
    const res = await this.req('post', '/settings', { events })
    expect(res.ok(), 'POST /settings').toBeTruthy()
    return res.json()
  }

  /** Clear the saved flush target, leaving the token in place. */
  clearTarget() {
    return this.setTarget({ server_id: '', site_id: '', server_name: '', site_domain: '' })
  }

  /**
   * The real, existing target the baseline pins to: the first Ploi server with at
   * least one site. Probed once per worker, then memoized. Connects the good token
   * first if needed (the probe needs an authenticated token).
   */
  async resolveCanonicalTarget() {
    if (canonicalTarget) return canonicalTarget

    const s = await this.settings()
    if (!s.hasToken || s.needsReconnect) {
      expect((await this.connectRaw(TOKENS.good)).ok(), 'connect good token').toBeTruthy()
    }

    const probe = await this.probe()
    for (const server of probe.servers || []) {
      const { sites } = await this.req('get', `/servers/${encodeURIComponent(server.id)}/sites`).then((r) => r.json())
      if (sites && sites.length) {
        canonicalTarget = {
          server_id: String(server.id),
          site_id: String(sites[0].id),
          server_name: server.name ?? '',
          site_domain: sites[0].domain ?? '',
        }
        return canonicalTarget
      }
    }
    throw new Error('[e2e] No Ploi server with a site is available to use as the baseline flush target.')
  }

  /**
   * Idempotent canonical resting state: connected good token + the canonical target.
   * Cheap when already there. Every state-mutating spec restores this in teardown, so
   * each spec is independent and the suite always leaves the baseline intact.
   */
  async ensureBaseline() {
    if (!TOKENS.good) return null

    const canonical = await this.resolveCanonicalTarget()
    let s = await this.settings()
    if (!s.hasToken || s.needsReconnect) {
      expect((await this.connectRaw(TOKENS.good)).ok(), 'baseline connect').toBeTruthy()
      s = await this.settings()
    }
    if (s.serverId !== canonical.server_id || s.siteId !== canonical.site_id || !s.isConfigured) {
      await this.setTarget(canonical)
    }
    return canonical
  }
}
