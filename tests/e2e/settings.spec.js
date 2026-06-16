import { test, expect } from '@playwright/test'

const ADMIN_USER = process.env.WP_ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.WP_ADMIN_PASS || 'password'
// Path prefix for installs that nest WordPress (e.g. Bedrock serves wp-admin
// under /wp). Empty for a standard install / the default wp-env target.
const WP_PREFIX = process.env.WP_PATH_PREFIX || ''
const SETTINGS_PATH = `${WP_PREFIX}/wp-admin/options-general.php?page=ploi-fastcgi-cache`

async function login(page) {
  await page.goto(`${WP_PREFIX}/wp-login.php`)
  await page.fill('#user_login', ADMIN_USER)
  await page.fill('#user_pass', ADMIN_PASS)
  await page.click('#wp-submit')
  await expect(page).toHaveURL(/wp-admin/)
}

async function openSettings(page) {
  await login(page)
  await page.goto(SETTINGS_PATH)
}

// Read the REST base + nonce the page was localized with (window.PloiCacheConfig).
function pageConfig(page) {
  return page.evaluate(() => ({
    restUrl: window.PloiCacheConfig.restUrl,
    nonce: window.PloiCacheConfig.nonce,
  }))
}

// Seed a "connected" state. POST /settings persists a token WITHOUT contacting
// Ploi, so this reaches hasToken=true offline. page.request carries the admin
// session cookies; the localized nonce satisfies guard().
async function seedConnection(page, overrides = {}) {
  const { restUrl, nonce } = await pageConfig(page)
  const res = await page.request.post(`${restUrl}/settings`, {
    headers: { 'X-WP-Nonce': nonce },
    data: {
      token: 'seed-token-e2e',
      server_id: '7',
      site_id: '42',
      server_name: 'Seed Server',
      site_domain: 'seed.example',
      events: { post_save: true, menu: true },
      debounce: 12,
      ...overrides,
    },
  })
  expect(res.ok()).toBeTruthy()
}

// Reset to the clean "no token" state other tests assume. Idempotent.
async function resetConnection(page) {
  const { restUrl, nonce } = await pageConfig(page)
  await page.request.delete(`${restUrl}/connection`, { headers: { 'X-WP-Nonce': nonce } })
}

test.describe('Ploi FastCGI Cache settings screen', () => {
  test.beforeEach(async ({ page }) => {
    await openSettings(page)
  })

  test('renders the live Alpine shell', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ploi FastCGI Cache' })).toBeVisible()
    await expect(page.locator('.ploi-cache-admin')).toBeVisible()
    await expect(page.locator('.ploi-cache-admin input[type="password"]')).toBeVisible()
  })

  test('renders all six event toggles from the localized config', async ({ page }) => {
    await expect(page.locator('.ploi-cache-admin input[type="checkbox"]')).toHaveCount(6)
  })

  test('disables "Flush now" until configured, with a reason', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Flush now/i })).toBeDisabled()
    await expect(page.locator('.ploi-cache-admin')).toContainText(/Add a Ploi API token first|Choose a server and site/i)
  })

  test('rejects an invalid coalesce window', async ({ page }) => {
    const input = page.locator('#ploi-debounce')
    await input.fill('999')
    await input.blur()
    await expect(page.getByRole('button', { name: /Save settings/i })).toBeDisabled()
  })
})

// These tests MUTATE the shared wp-env DB (seed then remove a token). They run
// serially and reset to the clean "no token" state in afterEach so the read-only
// tests above keep their unconfigured assumption. (With fullyParallel workers and
// one shared DB, run e2e with --workers=1 if you see cross-test contention.)
test.describe('Disconnect (remove the saved token)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await openSettings(page)
  })
  test.afterEach(async ({ page }) => {
    await resetConnection(page)
  })

  test('removes the token from storage and returns the card to the empty state', async ({ page }) => {
    await seedConnection(page)
    await page.reload()
    await expect(page.locator('.ploi-cache-admin')).toContainText('A token is saved.')

    // Two-step confirm: the first click only reveals the prompt — it must NOT disconnect.
    await page.getByRole('button', { name: 'Disconnect' }).click()
    await expect(page.getByText('Remove the saved token?')).toBeVisible()
    await expect(page.locator('.ploi-cache-admin')).toContainText('A token is saved.')

    // Confirm.
    await page.getByRole('button', { name: 'Yes, disconnect' }).click()
    await expect(page.locator('.ploi-cache-admin')).toContainText('No token saved yet.')

    // Flushing goes inert through the EXISTING gating (no new ungated path).
    await expect(page.getByRole('button', { name: 'Flush now' })).toBeDisabled()
    await expect(page.locator('.ploi-cache-admin')).toContainText('Add a Ploi API token first.')

    // STORAGE check: a fresh settings read proves the token is gone from the DB
    // (hasToken derives from the stored option, not UI state), target cleared,
    // events + debounce preserved, and the raw token never appears in the body.
    const { restUrl, nonce } = await pageConfig(page)
    const after = await page.request.get(`${restUrl}/settings`, { headers: { 'X-WP-Nonce': nonce } })
    const body = await after.json()
    expect(body.hasToken).toBe(false)
    expect(body.needsReconnect).toBe(false)
    expect(body.serverId).toBe('')
    expect(body.siteId).toBe('')
    expect(body.enabledEvents.post_save).toBe(true)
    expect(body.enabledEvents.menu).toBe(true)
    expect(body.debounce).toBe(12)
    expect(JSON.stringify(body)).not.toContain('seed-token-e2e')

    // Persisted: a full reload still shows the disconnected state.
    await page.reload()
    await expect(page.locator('.ploi-cache-admin')).toContainText('No token saved yet.')
  })

  test('Cancel keeps the token and hides the prompt', async ({ page }) => {
    await seedConnection(page)
    await page.reload()
    await page.getByRole('button', { name: 'Disconnect' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Remove the saved token?')).toBeHidden()
    await expect(page.locator('.ploi-cache-admin')).toContainText('A token is saved.')
  })
})

// §13 — the disconnect route must reject unauthenticated/forged requests. Both
// tests use a FRESH, cookieless request context (anonymous caller). Note the two
// distinct rejection layers, asserted by exact code so green can't mean "harness
// loosened":
//   * MISSING nonce passes WordPress core's auth layer (which only rejects a
//     present-but-invalid nonce) and reaches OUR guard() — proving the route is
//     wired through guard(). A guard-skipped route would 200; a capability-only
//     guard would return rest_forbidden. Neither is rest_invalid_nonce.
//   * A FORGED nonce is caught even earlier by core's global REST auth layer,
//     before any route runs — so the route is simply unreachable with a bad nonce.
// guard()'s capability half (non-admin → rest_forbidden) and its nonce half under
// internal dispatch are pinned by the rest_do_request checks in docs/e2e-tests.md §13.
test.describe('Disconnect endpoint security (§13)', () => {
  test.beforeEach(async ({ page }) => {
    await openSettings(page)
  })

  test('missing nonce is rejected by guard() (rest_invalid_nonce, 403)', async ({ page, playwright }) => {
    const restUrl = await page.evaluate(() => window.PloiCacheConfig.restUrl)
    const ctx = await playwright.request.newContext({ ignoreHTTPSErrors: true })
    const res = await ctx.delete(`${restUrl}/connection`)
    expect(res.status()).toBe(403)
    expect((await res.json()).code).toBe('rest_invalid_nonce')
    await ctx.dispose()
  })

  test('forged nonce is rejected before the route (rest_cookie_invalid_nonce, 403)', async ({ page, playwright }) => {
    const restUrl = await page.evaluate(() => window.PloiCacheConfig.restUrl)
    const ctx = await playwright.request.newContext({ ignoreHTTPSErrors: true })
    const res = await ctx.delete(`${restUrl}/connection`, { headers: { 'X-WP-Nonce': 'not-a-real-nonce' } })
    expect(res.status()).toBe(403)
    expect((await res.json()).code).toBe('rest_cookie_invalid_nonce')
    await ctx.dispose()
  })
})
