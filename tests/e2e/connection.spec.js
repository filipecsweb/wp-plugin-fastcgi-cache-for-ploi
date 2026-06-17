import { test, expect } from './support/fixtures.js'
import { TOKENS } from './support/config.js'

// Connect / disconnect with the good token, plus rejection of every bad and
// under-scoped token. The token input is disabled while connected, so the
// rejection cases disconnect first to exercise a real connect attempt.
test.describe('Connection', () => {
  test.skip(!TOKENS.good, 'needs PLOI_API_TOKEN_GOOD_READ_SERVERS_AND_READ_SITES_SCOPE in .claude/.env')

  test('connecting a valid token locks the input, swaps to Disconnect, clears the working token, and persists', async ({ connected, admin, api, settings }) => {
    await api.disconnect()
    await admin.reload()
    await expect(settings.connectButton).toBeVisible()
    await expect(settings.tokenInput).toBeEnabled()

    await settings.connect(TOKENS.good)

    // Durable outcome (the success toast auto-dismisses, so don't rely on it).
    await expect(settings.disconnectButton).toBeVisible()
    await expect(settings.tokenInput).toBeDisabled()
    await expect(settings.tokenInput).toHaveValue('')
    expect((await settings.state()).hasToken).toBe(true)
    expect((await api.settings()).hasToken).toBe(true)

    // Survives a reload, and the raw token is never exposed anywhere reachable.
    await admin.reload()
    await expect(settings.disconnectButton).toBeVisible()
    expect(JSON.stringify(await api.settings())).not.toContain(TOKENS.good)
    const cfgJson = await admin.evaluate(() => JSON.stringify(window.PloiCacheConfig))
    expect(cfgJson).not.toContain(TOKENS.good)
  })

  test('disconnecting clears the token and target, keeps event preferences, and makes Flush inert', async ({ connected, admin, api, settings }) => {
    const before = await api.settings()
    expect(before.hasToken).toBe(true)

    await settings.disconnectButton.click()
    await expect(settings.successToast).toContainText('Token removed. Add a new token to reconnect.')

    await expect(settings.connectButton).toBeVisible()
    await expect(settings.tokenInput).toBeEnabled()
    await expect(settings.flushNowButton).toBeDisabled()

    const after = await api.settings()
    expect(after.hasToken).toBe(false)
    expect(after.needsReconnect).toBe(false)
    expect(after.serverId).toBe('')
    expect(after.siteId).toBe('')
    // Event toggles are a user preference and survive a disconnect.
    expect(after.enabledEvents).toEqual(before.enabledEvents)

    await admin.reload()
    await expect(settings.connectButton).toBeVisible()
    // The `connected` fixture reconnects + restores the target in teardown.
  })

  const rejections = [
    { name: 'an invalid token', token: () => 'not-a-real-ploi-api-token', message: /was rejected/i, present: true },
    { name: 'a zero-scope token', token: () => TOKENS.noScope, message: /missing a required permission/i, present: !!TOKENS.noScope },
    { name: 'a servers-only token (fails the Sites-scope probe)', token: () => TOKENS.serversOnly, message: /missing a required permission/i, present: !!TOKENS.serversOnly },
    { name: 'a sites-only token (fails the Servers-scope probe)', token: () => TOKENS.sitesOnly, message: /missing a required permission/i, present: !!TOKENS.sitesOnly },
  ]

  for (const r of rejections) {
    test(`rejects ${r.name} with a clear message and saves nothing`, async ({ connected, admin, api, settings }) => {
      test.skip(!r.present, 'token not present in .claude/.env')

      await api.disconnect()
      await admin.reload()
      await settings.connect(r.token())

      await expect(settings.errorToast).toContainText(r.message)
      // Stays in the disconnected state; nothing was persisted.
      await expect(settings.connectButton).toBeVisible()
      expect((await api.settings()).hasToken).toBe(false)
    })
  }

  test('connecting with an empty token prompts for one (no request made)', async ({ connected, admin, api, settings }) => {
    await api.disconnect()
    await admin.reload()
    await settings.connectButton.click()

    await expect(settings.errorToast).toContainText('Add a Ploi API token first.')
    expect((await api.settings()).hasToken).toBe(false)
  })
})
