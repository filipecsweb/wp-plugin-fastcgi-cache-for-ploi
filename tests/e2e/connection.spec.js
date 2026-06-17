import { test, expect } from './fixtures.js'

// "Test token" is validate-ONLY (§2): it never saves and never loads the
// dropdowns — Save does both. So server/site selection (§3) happens AFTER a
// save, and the dropdowns react to a token change without a reload. The
// real-token tests exercise three scope levels from .claude/.env and skip
// cleanly when a token isn't present:
//   GOOD_TOKEN         — read Servers + read Sites (validates clean; full flow)
//   SERVERS_ONLY_TOKEN — read Servers only (fails the Sites-scope check)
//   NO_SCOPE_TOKEN     — valid but zero permissions (rejected at servers())
// The "invalid token" cases use a throwaway dummy — any non-token string is
// rejected by Ploi, so they need no real secret.

const GOOD_TOKEN = process.env.PLOI_API_TOKEN_GOOD_READ_SERVERS_AND_READ_SITES_SCOPE
const SERVERS_ONLY_TOKEN = process.env.PLOI_API_TOKEN_BAD_ONLY_READ_SERVERS_SCOPE
const NO_SCOPE_TOKEN = process.env.PLOI_API_TOKEN_BAD_NO_SCOPE_AT_ALL

const tokenInput = (admin) => admin.locator('.ploi-cache-admin input[type="password"]')
const serverSelect = (admin) => admin.locator('.ploi-cache-admin select').first()
const siteSelect = (admin) => admin.locator('.ploi-cache-admin select').nth(1)

// Save the good token, then pick its first server + first site, then save again —
// the two-step flow the validate-only split produces. Leaves a flushable config.
async function configureWithGoodToken(admin) {
  await tokenInput(admin).fill(GOOD_TOKEN)
  await admin.getByRole('button', { name: 'Save settings' }).click()
  await expect(serverSelect(admin)).toBeEnabled()
  await serverSelect(admin).selectOption({ index: 1 })
  await expect(siteSelect(admin)).toBeEnabled()
  await siteSelect(admin).selectOption({ index: 1 })
  await admin.getByRole('button', { name: 'Save settings' }).click()
  await expect(admin.getByRole('button', { name: 'Flush now' })).toBeEnabled()
}

test.describe('Test token — validate only, never saves (§2)', () => {
  test('clicking Test with an empty box prompts for a token', async ({ admin }) => {
    await admin.getByRole('button', { name: 'Test token' }).click()
    await expect(admin.locator('.ploi-cache-admin')).toContainText('Add a Ploi API token first.')
    await expect(serverSelect(admin)).toBeDisabled()
  })

  test('an invalid token is rejected and nothing is saved', async ({ admin, rest }) => {
    // Any non-token string is rejected by Ploi (401) at the GET /api/servers check.
    await tokenInput(admin).fill('not-a-valid-ploi-api-token')
    await admin.getByRole('button', { name: 'Test token' }).click()

    await expect(admin.locator('.ploi-cache-admin .notice-error')).toContainText(/rejected|went wrong/i)
    await expect(admin.locator('.ploi-cache-admin')).toContainText('No token saved yet.')
    expect((await rest.settings()).hasToken).toBe(false)
  })

  test('a good token validates but is NOT saved until you Save', async ({ admin, rest }) => {
    test.skip(!GOOD_TOKEN, 'needs PLOI_API_TOKEN_GOOD_READ_SERVERS_AND_READ_SITES_SCOPE')

    await tokenInput(admin).fill(GOOD_TOKEN)
    await admin.getByRole('button', { name: 'Test token' }).click()

    await expect(admin.locator('.ploi-cache-admin .notice-success')).toContainText(/works and has the required permissions/i)
    // Validate-only: nothing persisted, dropdown not loaded, field kept for Save.
    await expect(admin.locator('.ploi-cache-admin')).toContainText('No token saved yet.')
    await expect(serverSelect(admin)).toBeDisabled()
    await expect(tokenInput(admin)).toHaveValue(GOOD_TOKEN)
    expect((await rest.settings()).hasToken).toBe(false)
  })

  test('a no-permission token is rejected with a scope message', async ({ admin, rest }) => {
    test.skip(!NO_SCOPE_TOKEN, 'needs PLOI_API_TOKEN_BAD_NO_SCOPE_AT_ALL')

    await tokenInput(admin).fill(NO_SCOPE_TOKEN)
    await admin.getByRole('button', { name: 'Test token' }).click()

    // A valid but zero-scope token 403s at GET /api/servers — a "missing
    // permission" message, not the generic "rejected" (that is 401).
    await expect(admin.locator('.ploi-cache-admin .notice-error')).toContainText(/missing a required permission/i)
    expect((await rest.settings()).hasToken).toBe(false)
  })

  test('a servers-only token fails the Sites-scope check', async ({ admin, rest }) => {
    test.skip(!SERVERS_ONLY_TOKEN, 'needs PLOI_API_TOKEN_BAD_ONLY_READ_SERVERS_SCOPE')

    await tokenInput(admin).fill(SERVERS_ONLY_TOKEN)
    await admin.getByRole('button', { name: 'Test token' }).click()

    // servers() succeeds, but the Sites-scope probe 403s → reported as a missing
    // permission. (Old behavior connected; Test now verifies BOTH scopes.)
    await expect(admin.locator('.ploi-cache-admin .notice-error')).toContainText(/missing a required permission/i)
    expect((await rest.settings()).hasToken).toBe(false)
  })
})

test.describe('Save persists the token and the UI reacts without reload (§2/§3)', () => {
  test('saving a good token enables the Server dropdown in place', async ({ admin, rest }) => {
    test.skip(!GOOD_TOKEN, 'needs the good token')

    await tokenInput(admin).fill(GOOD_TOKEN)
    // Save (not Test) is what persists + loads — no reload needed.
    await admin.getByRole('button', { name: 'Save settings' }).click()

    await expect(admin.locator('.ploi-cache-admin')).toContainText('A token is saved.')
    await expect(serverSelect(admin)).toBeEnabled()
    await expect(serverSelect(admin).locator('option')).not.toHaveCount(1)
    expect((await rest.settings()).hasToken).toBe(true)
  })

  test('full flow: token → server → site → flush enabled', async ({ admin, rest }) => {
    test.skip(!GOOD_TOKEN, 'needs the good token')

    await configureWithGoodToken(admin)

    await expect(admin.getByText('Choose a server first.')).toBeHidden()
    expect((await rest.settings()).isConfigured).toBe(true)
  })

  test('saving a servers-only token clears a now-unreadable target (§3)', async ({ admin, rest }) => {
    test.skip(!GOOD_TOKEN || !SERVERS_ONLY_TOKEN, 'needs the good and servers-only tokens')

    await configureWithGoodToken(admin)

    // Downgrade via SAVE (Test no longer does this): the new token can't read the
    // saved site (403), so save clears the target instead of leaving it stale.
    await tokenInput(admin).fill(SERVERS_ONLY_TOKEN)
    await admin.getByRole('button', { name: 'Save settings' }).click()

    const liveNotice = admin.locator('.ploi-cache-admin .notice.is-dismissible')
    await expect(liveNotice).toContainText(/aren.t available with this token|Re-select your server/i)
    await expect(liveNotice).toHaveClass(/notice-warning/)
    await expect(admin.getByRole('button', { name: 'Flush now' })).toBeDisabled()

    const after = await rest.settings()
    expect(after.serverId).toBe('')
    expect(after.siteId).toBe('')
    expect(after.isConfigured).toBe(false)
  })

  test('saving a junk token over a good one disables the dropdown and flags rejection', async ({ admin }) => {
    test.skip(!GOOD_TOKEN, 'needs the good token')

    await configureWithGoodToken(admin)

    // A junk token persists (save never validates) but the in-place reload fails:
    // options cleared, dropdown disabled, the saved token flagged as rejected.
    await tokenInput(admin).fill('not-a-valid-ploi-api-token')
    await admin.getByRole('button', { name: 'Save settings' }).click()

    await expect(admin.locator('.ploi-cache-admin .notice-error')).toContainText(/rejected|went wrong/i)
    await expect(admin.locator('.ploi-cache-admin')).toContainText(/Ploi rejected it/i)
    await expect(serverSelect(admin)).toBeDisabled()
  })
})

test.describe('Connection — encryption-key warning (§12)', () => {
  test('the key-source notice shows exactly when the config flags a DB-derived key', async ({ admin }) => {
    const keyWarning = await admin.evaluate(() => !!window.PloiCacheConfig.keyWarning)
    const notice = admin.getByText('For stronger security, define a dedicated encryption key')
    // The banner is always in the DOM (x-show toggles display), so assert
    // visibility, which must mirror the server-computed keyWarning flag.
    if (keyWarning) {
      await expect(notice).toBeVisible()
    } else {
      await expect(notice).toBeHidden()
    }
  })
})

test.describe('Disconnect — remove the saved token (§11b)', () => {
  test('removes the token from storage and returns the card to the empty state', async ({ admin, rest }) => {
    await rest.seed()
    await admin.reload()
    // The seed token is a fake string, so on reload the live token check rejects
    // it — but a token IS saved, so Disconnect is offered.
    await expect(admin.getByRole('button', { name: 'Disconnect' })).toBeVisible()

    // Two-step confirm: the first click only reveals the prompt.
    await admin.getByRole('button', { name: 'Disconnect' }).click()
    await expect(admin.getByText('Remove the saved token?')).toBeVisible()

    await admin.getByRole('button', { name: 'Yes, disconnect' }).click()
    await expect(admin.locator('.ploi-cache-admin')).toContainText('No token saved yet.')
    await expect(admin.getByRole('button', { name: 'Flush now' })).toBeDisabled()

    // Gone from storage (not just the UI), target cleared, raw token absent.
    const after = await rest.settings()
    expect(after.hasToken).toBe(false)
    expect(after.needsReconnect).toBe(false)
    expect(after.serverId).toBe('')
    expect(after.siteId).toBe('')
    expect(JSON.stringify(after)).not.toContain('seed-token-e2e')

    await admin.reload()
    await expect(admin.locator('.ploi-cache-admin')).toContainText('No token saved yet.')
  })

  test('Cancel keeps the token and hides the prompt', async ({ admin, rest }) => {
    await rest.seed()
    await admin.reload()
    await admin.getByRole('button', { name: 'Disconnect' }).click()
    await admin.getByRole('button', { name: 'Cancel' }).click()
    await expect(admin.getByText('Remove the saved token?')).toBeHidden()
    await expect(admin.getByRole('button', { name: 'Disconnect' })).toBeVisible()
  })
})
