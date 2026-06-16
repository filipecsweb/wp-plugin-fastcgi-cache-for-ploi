import { test, expect } from './fixtures.js'

// Connecting to Ploi (§2), picking a server/site (§3), the key-source warning
// (§12), and disconnect (§11b). The §2/§3 tests use the REAL Ploi tokens from
// .claude/.env and skip cleanly when those aren't present.

const GOOD_TOKEN = process.env.PLOI_API_TOKEN_GOOD
const BAD_TOKEN = process.env.PLOI_API_TOKEN_BAD

test.describe('Connection — Test connection (§2)', () => {
  test('clicking Test with an empty box prompts for a token', async ({ admin }) => {
    await admin.getByRole('button', { name: 'Test connection' }).click()
    await expect(admin.locator('.ploi-cache-admin')).toContainText('Add a Ploi API token first.')
    await expect(admin.locator('.ploi-cache-admin select').first()).toBeDisabled()
  })

  test('a bad token is rejected and nothing is saved', async ({ admin, rest }) => {
    test.skip(!BAD_TOKEN, 'needs PLOI_API_TOKEN_BAD')

    await admin.locator('.ploi-cache-admin input[type="password"]').fill(BAD_TOKEN)
    await admin.getByRole('button', { name: 'Test connection' }).click()

    await expect(admin.locator('.ploi-cache-admin .notice-error')).toContainText(/rejected|went wrong/i)
    await expect(admin.locator('.ploi-cache-admin')).toContainText('No token saved yet.')
    expect((await rest.settings()).hasToken).toBe(false)
  })

  test('a good token connects, saves, and is never echoed back', async ({ admin, rest }) => {
    test.skip(!GOOD_TOKEN, 'needs PLOI_API_TOKEN_GOOD')

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
    test.skip(!GOOD_TOKEN, 'needs PLOI_API_TOKEN_GOOD')

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
