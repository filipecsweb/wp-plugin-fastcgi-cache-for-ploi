import { test, expect, SETTINGS_PATH } from './fixtures.js'

// §13 — permissions + request integrity. Two rejection layers, asserted by exact
// code so a green run can't mean "the harness loosened":
//   * capability half of guard()  → rest_forbidden   (logged-in non-admin)
//   * nonce half / core auth layer → rest_invalid_nonce / rest_cookie_invalid_nonce

const WP_PREFIX = process.env.WP_PATH_PREFIX || ''

test.describe('Permissions & request integrity (§13)', () => {
  test('a non-admin cannot open the settings screen', async ({ subscriber }) => {
    await subscriber.goto(SETTINGS_PATH)
    await expect(subscriber.locator('.ploi-cache-admin')).toHaveCount(0)
    await expect(subscriber.locator('body')).toContainText(/not allowed|sufficient permissions|do not have permission/i)
  })

  test('a logged-in non-admin is forbidden from the write routes (rest_forbidden, 403)', async ({ admin, subscriber }) => {
    const restUrl = await admin.evaluate(() => window.PloiCacheConfig.restUrl)
    // A real wp_rest nonce bound to the SUBSCRIBER session, via core's rest-nonce
    // ajax action — so the request clears the nonce layer and reaches our guard's
    // capability check, proving rest_forbidden is the capability half (not nonce).
    const nonce = (await (await subscriber.request.get(`${WP_PREFIX}/wp-admin/admin-ajax.php?action=rest-nonce`)).text()).trim()

    const res = await subscriber.request.delete(`${restUrl}/connection`, { headers: { 'X-WP-Nonce': nonce } })
    expect(res.status()).toBe(403)
    expect((await res.json()).code).toBe('rest_forbidden')
  })

  test('missing nonce is rejected by guard() (rest_invalid_nonce, 403)', async ({ admin, playwright }) => {
    const restUrl = await admin.evaluate(() => window.PloiCacheConfig.restUrl)
    const ctx = await playwright.request.newContext({ ignoreHTTPSErrors: true })
    const res = await ctx.delete(`${restUrl}/connection`)
    expect(res.status()).toBe(403)
    expect((await res.json()).code).toBe('rest_invalid_nonce')
    await ctx.dispose()
  })

  test('forged nonce is rejected before the route (rest_cookie_invalid_nonce, 403)', async ({ admin, playwright }) => {
    const restUrl = await admin.evaluate(() => window.PloiCacheConfig.restUrl)
    const ctx = await playwright.request.newContext({ ignoreHTTPSErrors: true })
    const res = await ctx.delete(`${restUrl}/connection`, { headers: { 'X-WP-Nonce': 'not-a-real-nonce' } })
    expect(res.status()).toBe(403)
    expect((await res.json()).code).toBe('rest_cookie_invalid_nonce')
    await ctx.dispose()
  })
})
