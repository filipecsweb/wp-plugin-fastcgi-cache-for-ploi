import { test, expect } from './support/fixtures.js'
import { TOKENS, MOCK } from './support/config.js'
import { wpErrorRoute } from './support/mock.js'

/**
 * A SAVED, known-good token that Ploi LATER rejects must raise the single persistent
 * reconnect banner — but a WordPress nonce/capability rejection (same 401/403, no
 * Ploi error code) must NOT, or an expired nonce would tear down a healthy token.
 *
 * This is the one branch the rest of the suite never executes: the connection specs
 * reject tokens at connect() (a fresh attempt → toast, not the banner), and the
 * deleted-target specs mock 200-with-gone payloads. Here a good token is saved and
 * the Ploi-backed /flush response is mocked, driving flushNow() → the error
 * classifier (errors.js) → requireReconnect.
 */
test.describe('Reconnect required (saved token rejected by Ploi)', () => {
  test.skip(!TOKENS.good, 'needs the good Ploi token in .claude/.env')

  // Each rejected /flush response and the reason code the banner copy is keyed to.
  const rejections = [
    { name: 'an outright rejection (Ploi 401)', status: 401, code: 'ploi_error', reason: 'invalid' },
    { name: 'an under-scoped token (Ploi 403)', status: 403, code: 'ploi_error', reason: 'missing_permission' },
    { name: 'an unreadable saved token (409 / needs_reconnect)', status: 409, code: 'needs_reconnect', reason: 'unreadable' },
  ]

  for (const r of rejections) {
    test(`${r.name} raises the reconnect banner`, async ({ connected, admin, settings }) => {
      await expect(settings.flushNowButton).toBeEnabled() // the baseline target is flushable

      await wpErrorRoute(admin, MOCK.flush, r.code, 'Ploi rejected the request.', r.status)
      await settings.flushNowButton.click()

      await expect(settings.reconnectBanner).toBeVisible()
      const state = await settings.state()
      expect(state.needsReconnect).toBe(true)
      expect(state.reconnectReason).toBe(r.reason)
      expect(state.hasToken).toBe(false) // the saved token is now treated as unusable
      // The `connected` fixture restores the baseline (token + target) in teardown.
    })
  }

  test('a WordPress capability 401 stays transient and keeps the saved token', async ({ connected, admin, settings }) => {
    await expect(settings.flushNowButton).toBeEnabled()

    // Same 401 status, but WP's own guard code rather than a Ploi error — must surface
    // as a toast and leave the healthy token in place (the false-positive guard).
    // WHY not rest_cookie_invalid_nonce: core's apiFetch refreshes the nonce and retries
    // on that code, so a mock that always answers with it never settles.
    await wpErrorRoute(admin, MOCK.flush, 'rest_forbidden', 'Sorry, you are not allowed to do that.', 401)
    await settings.flushNowButton.click()

    await expect(settings.errorToast).toContainText('Sorry, you are not allowed to do that.')
    await expect(settings.reconnectBanner).toBeHidden()
    const state = await settings.state()
    expect(state.needsReconnect).toBe(false)
    expect(state.hasToken).toBe(true)
  })
})
