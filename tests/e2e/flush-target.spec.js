import { test, expect } from './support/fixtures.js'
import { TOKENS } from './support/config.js'

// Choosing and changing the flush target through the modal. The good-token baseline
// is connected with a valid target; these specs mutate it and the fixture restores.
test.describe('Flush target', () => {
  test.skip(!TOKENS.good, 'needs the good Ploi token in .claude/.env')

  test('choose a target: modal → server → site → save enables Flush and persists', async ({ connected, admin, api, settings }) => {
    // Start connected but with NO target so we exercise the full choose flow.
    await api.clearTarget()
    await admin.reload()
    await expect(settings.targetButton).toHaveText('Select target')
    await expect(settings.flushNowButton).toBeDisabled()

    await settings.openTargetModal()
    // Site picker is gated until a server is chosen.
    await expect(settings.siteSelect).toBeDisabled()
    await expect(settings.modal).toContainText('Choose a server first.')

    const chosen = await settings.chooseFirstAvailableTarget()
    await settings.saveTargetButton.click()
    await expect(settings.modal).toBeHidden()

    // Summary + Flush now reflect the chosen target.
    await expect(settings.flushNowButton).toBeEnabled()
    await expect(settings.root).toContainText('Currently flushing:')
    await expect(settings.targetButton).toHaveText('Change')

    const saved = await api.settings()
    expect(saved.serverId).toBe(chosen.serverId)
    expect(saved.siteId).toBe(chosen.siteId)
    expect(saved.isConfigured).toBe(true)

    // Persists across a reload.
    await admin.reload()
    await expect(settings.flushNowButton).toBeEnabled()
  })

  test('change the target: switching server resets the site, reloads the list, and the save updates the target', async ({ connected, admin, api, settings }) => {
    const baseline = await api.settings()
    await admin.reload()
    await expect(settings.targetButton).toHaveText('Change')

    await settings.openTargetModal()
    // Pre-seeded with the saved server, its sites already hydrated.
    await expect(settings.serverSelect).toHaveValue(String(baseline.serverId))
    await expect(settings.siteSelect).toBeEnabled()

    const altServer = await settings.selectServerWithSites(baseline.serverId)
    // Switching server cleared the held site and reloaded the list for the new server.
    expect(altServer).not.toBe(String(baseline.serverId))
    expect((await settings.state()).siteId).toBe('')
    await expect(settings.serverSelect).toHaveValue(altServer)

    await settings.siteSelect.selectOption({ index: 1 })
    await settings.saveTargetButton.click()
    await expect(settings.modal).toBeHidden()

    const saved = await api.settings()
    expect(saved.serverId).toBe(altServer)
    expect(saved.serverId).not.toBe(String(baseline.serverId))
    expect(saved.isConfigured).toBe(true)

    await admin.reload()
    await expect(settings.root).toContainText('Currently flushing:')
    // The `connected` fixture restores the canonical target in teardown.
  })
})
