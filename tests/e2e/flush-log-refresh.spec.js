import { test, expect } from './support/fixtures.js'
import { TOKENS, MOCK } from './support/config.js'
import { jsonRoute } from './support/mock.js'

/**
 * FIL-26: after "Flush now", the Recent flushes table must reflect the attempt
 * WITHOUT a manual refresh/reload — on BOTH success and failure.
 *
 * The bug: flushNow() awaited loadLog() only in the success branch, so a failed
 * flush left the audit table stale even though the server had already written the
 * failure row. The fix moves loadLog() into a finally, so the table refreshes after
 * every attempt.
 *
 * These drive real (un-mocked) flushes so the server actually writes the log row —
 * mocking /flush would write no row and wouldn't exercise the fix. The failure case
 * mirrors deleted-target.spec.js (F4): point the saved target at bogus Ploi IDs and
 * flush for real (Ploi answers 404). The `connected` fixture restores the baseline
 * target in teardown. Neither test ever clicks Refresh — a changed top-row id is the
 * proof the table re-read on its own.
 */
test.describe('Flush now refreshes the Recent flushes table (FIL-26)', () => {
  test.skip(!TOKENS.good, 'needs the good Ploi token in .claude/.env')

  test('a FAILED manual flush adds the failure row with no manual refresh', async ({ connected, admin, api, settings }) => {
    // Point the saved target at non-existent Ploi IDs (the /target route does not
    // re-probe), then flush for real so Ploi rejects it (404) and the server logs
    // the failure row.
    await api.setTarget({ server_id: '999999999', site_id: '999999999', server_name: 'Ghost', site_domain: 'ghost.example' })
    await admin.reload()
    await expect(settings.flushNowButton).toBeEnabled()

    const before = await settings.logState()

    await settings.flushNowButton.click()

    // The failure still surfaces exactly as before (regression guard on the toast)...
    await expect(settings.errorToast).toContainText(/deleted|no longer|not found|removed/i)
    // ...and the audit table refreshes on its own — the Refresh button is never touched.
    await settings.waitForFlushSettled()
    const after = await settings.logState()
    expect(after.topId).not.toBe(before.topId) // a new row arrived without a manual refresh

    // The new top row renders as a Failed / HTTP 404 attempt (bad IDs → 404).
    await settings.logsTab.click()
    const topRow = settings.logRows.first()
    await expect(topRow).toBeVisible()
    await expect(topRow).toContainText('Failed')
    await expect(topRow).toContainText('HTTP 404')
  })

  test('a SUCCESSFUL manual flush still refreshes the table (regression guard)', async ({ connected, admin, settings }) => {
    // Force a deterministic success: a real flush isn't reliable here because some
    // Ploi sites answer 422 ("FastCGI caching not enabled"). This guards only that
    // the SUCCESS branch still triggers the log refresh; the failure test above is
    // the real, un-mocked gate. GET /log is left un-mocked so we assert the actual
    // refresh fires — if a regression put loadLog back in a success-only spot it
    // would still be caught, but a regression that dropped it entirely times out here.
    await jsonRoute(admin, MOCK.flush, { success: true, message: 'FastCGI cache flushed.' })
    await expect(settings.flushNowButton).toBeEnabled()

    const logRefreshed = admin.waitForResponse((r) => /\/v1\/log$/.test(r.url()) && r.request().method() === 'GET')
    await settings.flushNowButton.click()

    await expect(settings.successToast).toBeVisible()
    await logRefreshed // the success path re-read the log without a manual refresh
  })
})
