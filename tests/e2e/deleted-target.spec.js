import { test, expect } from './support/fixtures.js'
import { TOKENS, MOCK } from './support/config.js'

/**
 * Deleted-target regressions (F1–F4). Each test enforces the behavior when a saved
 * server/site has been deleted in Ploi out from under the plugin.
 *
 * Deletions are simulated by route-mocking the UI's own Ploi-backed fetches
 * (/connection, /servers/{id}/sites). page.route does not touch the harness's
 * page.request, so `api` still reads/writes the real saved state. The saved IDs are
 * read live and excluded from the mocked lists — never assumed.
 *
 * F4 is the exception: it does NOT mock /flush. Mocking the flush response would
 * hardcode the message and never exercise the server-side gloss. Instead it points
 * the saved target at non-existent Ploi IDs and flushes for real, exercising
 * FlushController/FlushLogEntry::failureHint(). (Deliberate divergence from the
 * prompt's "mock /flush" suggestion.)
 */
test.describe('Deleted flush target (F1–F4)', () => {
  test.skip(!TOKENS.good, 'needs the good Ploi token in .claude/.env')

  const jsonRoute = (page, glob, payload, status = 200) =>
    page.route(glob, (route) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
    )

  test('a deleted SITE is flagged in the modal and the stale site is not re-savable (F2/F3)', async ({ connected, admin, api, settings }) => {
    const saved = await api.settings()

    // Server still exists; its site list no longer contains the saved site.
    await jsonRoute(admin, MOCK.connection, {
      state: 'ok',
      servers: [{ id: saved.serverId, name: saved.serverName }, { id: 'mock-server', name: 'Another server' }],
      sites: [],
    })
    await jsonRoute(admin, MOCK.sites, {
      sites: [{ id: 'mock-site-1', domain: 'other-a.example' }, { id: 'mock-site-2', domain: 'other-b.example' }],
    })

    await settings.openTargetModal()
    await expect(settings.serverSelect).toHaveValue(String(saved.serverId)) // server resolves fine

    // The modal tells the user the saved site is gone, the held siteId is cleared, and
    // Save target is disabled so the phantom can't be re-persisted.
    await expect(settings.modal).toContainText(/no longer|deleted|couldn.?t find|not found|removed/i)
    expect((await settings.state()).siteId).toBe('')
    await expect(settings.saveTargetButton).toBeDisabled()
  })

  test('a deleted SERVER is flagged in the modal and the stale target is not re-savable (F2/F3)', async ({ connected, admin, api, settings }) => {
    const saved = await api.settings()

    // The saved server is absent from the (non-empty) live list — i.e. deleted.
    await jsonRoute(admin, MOCK.connection, {
      state: 'ok',
      servers: [{ id: 'mock-server-a', name: 'Other server A' }, { id: 'mock-server-b', name: 'Other server B' }],
      sites: [],
    })

    await settings.openTargetModal()

    // The modal explains the saved server is gone, both held IDs are cleared, and Save
    // target is disabled.
    await expect(settings.modal).toContainText(/no longer|deleted|couldn.?t find|not found|removed/i)
    const state = await settings.state()
    expect(state.serverId).toBe('')
    expect(state.siteId).toBe('')
    await expect(settings.saveTargetButton).toBeDisabled()
    expect(saved.serverId).not.toBe('') // sanity: there really was a saved server
  })

  test('a deleted target is no longer advertised as flushable (F1)', async ({ connected, admin, settings }) => {
    // Probe reveals the saved server is gone the moment the modal opens.
    await jsonRoute(admin, MOCK.connection, {
      state: 'ok',
      servers: [{ id: 'mock-server-a', name: 'Other server A' }, { id: 'mock-server-b', name: 'Other server B' }],
      sites: [],
    })

    await settings.openTargetModal()
    await settings.cancelButton.click()
    await expect(settings.modal).toBeHidden()

    // Once known gone, the summary + Flush now stop advertising the dead target.
    expect((await settings.state()).canFlush).toBe(false)
    await expect(settings.flushNowButton).toBeDisabled()
  })

  test('flushing a deleted target explains it may have been deleted (F4)', async ({ connected, admin, api, settings }) => {
    // Point the saved target at non-existent Ploi IDs (the /target route does not
    // re-probe), then flush for real against the live backend.
    await api.setTarget({ server_id: '999999999', site_id: '999999999', server_name: 'Ghost', site_domain: 'ghost.example' })
    await admin.reload()
    await expect(settings.flushNowButton).toBeEnabled()

    await settings.flushNowButton.click()

    // A clear "target may have been deleted" message, not a raw Ploi 404.
    await expect(settings.errorToast).toContainText(/deleted|no longer (exists|available)|may have been removed/i)
    // The `connected` fixture restores the canonical target in teardown.
  })
})
