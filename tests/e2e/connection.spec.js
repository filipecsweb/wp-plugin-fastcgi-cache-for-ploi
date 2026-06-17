import { test, expect } from './fixtures.js'

// Connecting to Ploi (§2), picking a server/site (§3), the key-source warning
// (§12), and disconnect (§11b). The real-token tests exercise three scope levels
// from .claude/.env and skip cleanly when a token isn't present:
//   GOOD_TOKEN         — read Servers + read Sites (full happy path + flush)
//   SERVERS_ONLY_TOKEN — read Servers only (connects, but cannot load sites)
//   NO_SCOPE_TOKEN     — valid but zero permissions (rejected at connect)
// The "invalid token" rejection uses a throwaway dummy — any non-token string is
// rejected by Ploi, so it needs no real secret.

const GOOD_TOKEN = process.env.PLOI_API_TOKEN_GOOD_READ_SERVERS_AND_READ_SITES_SCOPE
const SERVERS_ONLY_TOKEN = process.env.PLOI_API_TOKEN_BAD_ONLY_READ_SERVERS_SCOPE
const NO_SCOPE_TOKEN = process.env.PLOI_API_TOKEN_BAD_NO_SCOPE_AT_ALL

test.describe('Connection — Test connection (§2)', () => {
  test('clicking Test with an empty box prompts for a token', async ({ admin }) => {
    await admin.getByRole('button', { name: 'Test connection' }).click()
    await expect(admin.locator('.ploi-cache-admin')).toContainText('Add a Ploi API token first.')
    await expect(admin.locator('.ploi-cache-admin select').first()).toBeDisabled()
  })

  test('an invalid token is rejected and nothing is saved', async ({ admin, rest }) => {
    // An invalid token needs no real secret: any non-token string is rejected by
    // Ploi (401) at the GET /api/servers check that "Test connection" performs.
    await admin.locator('.ploi-cache-admin input[type="password"]').fill('not-a-valid-ploi-api-token')
    await admin.getByRole('button', { name: 'Test connection' }).click()

    await expect(admin.locator('.ploi-cache-admin .notice-error')).toContainText(/rejected|went wrong/i)
    await expect(admin.locator('.ploi-cache-admin')).toContainText('No token saved yet.')
    expect((await rest.settings()).hasToken).toBe(false)
  })

  test('a good token connects, saves, and is never echoed back', async ({ admin, rest }) => {
    test.skip(!GOOD_TOKEN, 'needs PLOI_API_TOKEN_GOOD_READ_SERVERS_AND_READ_SITES_SCOPE')

    await admin.locator('.ploi-cache-admin input[type="password"]').fill(GOOD_TOKEN)
    await admin.getByRole('button', { name: 'Test connection' }).click()

    await expect(admin.locator('.ploi-cache-admin .notice-success')).toContainText(/Connection successful/i)
    await expect(admin.locator('.ploi-cache-admin')).toContainText('A token is saved.')
    await expect(admin.locator('.ploi-cache-admin input[type="password"]')).toHaveValue('')
    // Servers loaded into the dropdown (placeholder + at least one real option).
    await expect(admin.locator('.ploi-cache-admin select').first().locator('option')).not.toHaveCount(1)

    // The raw token never comes back: not in the settings response, not on the page.
    const settings = await rest.settings()
    expect(settings.hasToken).toBe(true)
    expect(JSON.stringify(settings)).not.toContain(GOOD_TOKEN)
    expect(await admin.content()).not.toContain(GOOD_TOKEN)
  })
})

test.describe('Connection — server/site selection (§3)', () => {
  test('selecting a server loads its sites and clears the "pick a server" guidance', async ({ admin, rest }) => {
    test.skip(!GOOD_TOKEN, 'needs PLOI_API_TOKEN_GOOD_READ_SERVERS_AND_READ_SITES_SCOPE')

    await admin.locator('.ploi-cache-admin input[type="password"]').fill(GOOD_TOKEN)
    await admin.getByRole('button', { name: 'Test connection' }).click()
    await expect(admin.locator('.ploi-cache-admin .notice-success')).toBeVisible()

    const serverSelect = admin.locator('.ploi-cache-admin select').first()
    const siteSelect = admin.locator('.ploi-cache-admin select').nth(1)

    // Before a server is chosen, the site field guides you to pick one.
    await expect(admin.getByText('Choose a server first.')).toBeVisible()
    await expect(siteSelect).toBeDisabled()

    await serverSelect.selectOption({ index: 1 })
    // Server is set → the "pick a server first" guidance is gone (x-show hides it,
    // so assert visibility rather than DOM presence) and the site request settled.
    await expect(admin.getByText('Choose a server first.')).toBeHidden()
    // `rest` is destructured so its teardown disconnects the real token after.
    void rest
  })
})

test.describe('Connection — token scopes & downgrade (§2/§3)', () => {
  test('a no-permission token is rejected at connect with a scope message', async ({ admin, rest }) => {
    test.skip(!NO_SCOPE_TOKEN, 'needs PLOI_API_TOKEN_BAD_NO_SCOPE_AT_ALL')

    await admin.locator('.ploi-cache-admin input[type="password"]').fill(NO_SCOPE_TOKEN)
    await admin.getByRole('button', { name: 'Test connection' }).click()

    // A valid but zero-scope token fails GET /api/servers with 403 — surfaced as
    // a "missing permission" message, NOT the generic "rejected" (that is 401).
    await expect(admin.locator('.ploi-cache-admin .notice-error')).toContainText(/missing a required permission/i)
    await expect(admin.locator('.ploi-cache-admin')).toContainText('No token saved yet.')
    expect((await rest.settings()).hasToken).toBe(false)
  })

  test('a servers-only token connects but cannot load sites', async ({ admin, rest }) => {
    test.skip(!SERVERS_ONLY_TOKEN, 'needs PLOI_API_TOKEN_BAD_ONLY_READ_SERVERS_SCOPE')

    await admin.locator('.ploi-cache-admin input[type="password"]').fill(SERVERS_ONLY_TOKEN)
    await admin.getByRole('button', { name: 'Test connection' }).click()
    await expect(admin.locator('.ploi-cache-admin .notice-success')).toContainText(/Connection successful/i)

    // Servers load, but selecting one fails to load its sites with the scope
    // message, and the site dropdown stays disabled — you cannot pick a site.
    const serverSelect = admin.locator('.ploi-cache-admin select').first()
    await expect(serverSelect.locator('option')).not.toHaveCount(1)
    await serverSelect.selectOption({ index: 1 })
    await expect(admin.locator('.ploi-cache-admin .notice-error')).toContainText(/missing a required permission/i)
    await expect(admin.locator('.ploi-cache-admin select').nth(1)).toBeDisabled()
    void rest
  })

  test('switching to a servers-only token clears the now-unreadable target', async ({ admin, rest }) => {
    test.skip(!GOOD_TOKEN || !SERVERS_ONLY_TOKEN, 'needs the good and servers-only tokens')

    // Configure fully with the good token (first server + its first site).
    await admin.locator('.ploi-cache-admin input[type="password"]').fill(GOOD_TOKEN)
    await admin.getByRole('button', { name: 'Test connection' }).click()
    await expect(admin.locator('.ploi-cache-admin .notice-success')).toBeVisible()
    await admin.locator('.ploi-cache-admin select').first().selectOption({ index: 1 })
    const siteSelect = admin.locator('.ploi-cache-admin select').nth(1)
    await expect(siteSelect).toBeEnabled()
    await siteSelect.selectOption({ index: 1 })
    await admin.getByRole('button', { name: 'Save settings' }).click()
    await expect(admin.getByRole('button', { name: 'Flush now' })).toBeEnabled()

    // Downgrade: a token that can read servers but not sites. The plugin
    // re-validates the saved target, finds it unreadable (403), and clears it —
    // instead of silently leaving a stale, still-flushable target behind.
    await admin.locator('.ploi-cache-admin input[type="password"]').fill(SERVERS_ONLY_TOKEN)
    await admin.getByRole('button', { name: 'Test connection' }).click()

    // The live (dismissible) notice is the dynamic one; static notice-warning
    // templates (reconnect / disconnect-confirm) also sit in the DOM, hidden.
    const liveNotice = admin.locator('.ploi-cache-admin .notice.is-dismissible')
    await expect(liveNotice).toContainText(/cannot read your configured site/i)
    await expect(liveNotice).toHaveClass(/notice-warning/)
    await expect(admin.getByRole('button', { name: 'Flush now' })).toBeDisabled()

    const after = await rest.settings()
    expect(after.serverId).toBe('')
    expect(after.siteId).toBe('')
    expect(after.isConfigured).toBe(false)
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
    await expect(admin.locator('.ploi-cache-admin')).toContainText('A token is saved.')

    // Two-step confirm: the first click only reveals the prompt.
    await admin.getByRole('button', { name: 'Disconnect' }).click()
    await expect(admin.getByText('Remove the saved token?')).toBeVisible()
    await expect(admin.locator('.ploi-cache-admin')).toContainText('A token is saved.')

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
    await expect(admin.locator('.ploi-cache-admin')).toContainText('A token is saved.')
  })
})
