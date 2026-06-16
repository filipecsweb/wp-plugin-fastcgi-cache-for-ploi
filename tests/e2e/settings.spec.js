import { test, expect } from './fixtures.js'

// UI of the settings screen: shell, event toggles, the coalesce window, saving +
// persistence, and the native-styling smoke test. Connection/disconnect lives in
// connection.spec.js; permissions in security.spec.js; auto-flush in autoflush.spec.js.

test.describe('Settings screen — unconfigured', () => {
  test('renders the live Alpine shell (§1)', async ({ admin }) => {
    await expect(admin.getByRole('heading', { name: 'FastCGI Cache for Ploi' })).toBeVisible()
    await expect(admin.locator('.ploi-cache-admin')).toBeVisible()
    await expect(admin.locator('.ploi-cache-admin input[type="password"]')).toBeVisible()
  })

  test('renders all six event toggles from the localized config (§4)', async ({ admin }) => {
    await expect(admin.locator('.ploi-cache-admin input[type="checkbox"]')).toHaveCount(6)
  })

  test('disables "Flush now" until configured, with a reason (§7)', async ({ admin }) => {
    await expect(admin.getByRole('button', { name: /Flush now/i })).toBeDisabled()
    await expect(admin.locator('.ploi-cache-admin')).toContainText(/Add a Ploi API token first|Choose a server and site/i)
  })

  test('rejects an invalid coalesce window (§5)', async ({ admin }) => {
    const input = admin.locator('#ploi-debounce')
    await input.fill('999')
    await input.blur()
    await expect(admin.getByRole('button', { name: /Save settings/i })).toBeDisabled()
  })
})

test.describe('Settings screen — event toggles (§4)', () => {
  test('enable all / disable all and the count track the toggles', async ({ admin }) => {
    const root = admin.locator('.ploi-cache-admin')
    const checks = root.locator('input[type="checkbox"]')

    await root.getByRole('button', { name: 'Disable all' }).click()
    await expect(root).toContainText('0 of 6 events enabled')
    await expect(checks.first()).not.toBeChecked()

    await root.getByRole('button', { name: 'Enable all' }).click()
    await expect(root).toContainText('6 of 6 events enabled')
    await expect(checks.first()).toBeChecked()

    await checks.first().uncheck()
    await expect(root).toContainText('5 of 6 events enabled')
  })
})

test.describe('Settings screen — saving (§6)', () => {
  test('saves events + debounce and they survive a reload', async ({ admin, rest }) => {
    const root = admin.locator('.ploi-cache-admin')

    await root.getByRole('button', { name: 'Disable all' }).click()
    await admin.locator('.ploi-cache-admin input[type="checkbox"]').first().check() // post_save
    const debounce = admin.locator('#ploi-debounce')
    await debounce.fill('0')
    await debounce.blur()
    await admin.getByRole('button', { name: /Save settings/i }).click()
    await expect(root).toContainText('Settings saved.')

    // Persisted server-side…
    const saved = await rest.settings()
    expect(saved.debounce).toBe(0)
    expect(saved.enabledEvents.post_save).toBe(true)

    // …and survives a full reload.
    await admin.reload()
    await expect(admin.locator('#ploi-debounce')).toHaveValue('0')
    await expect(admin.locator('.ploi-cache-admin input[type="checkbox"]').first()).toBeChecked()
  })

  test('a saved connection hydrates the UI on reload (§6)', async ({ admin, rest }) => {
    await rest.seed({ debounce: 7 })
    await admin.reload()
    await expect(admin.locator('#ploi-debounce')).toHaveValue('7')
    await expect(admin.locator('.ploi-cache-admin')).toContainText('A token is saved.')
    await expect(admin.locator('.ploi-cache-admin')).toContainText('Currently flushing:')
  })

  test('a token with no server/site is not a flushable config (§6)', async ({ admin, rest }) => {
    await rest.seed({ server_id: '', site_id: '' })
    await admin.reload()
    await expect(admin.getByRole('button', { name: /Flush now/i })).toBeDisabled()
    await expect(admin.locator('.ploi-cache-admin')).toContainText(/Choose a server and site/i)
  })
})

// Tailwind preflight is OFF on this screen, so a newly added control renders raw
// until given a native wp-admin class. Fails if ANY actionable control carries no
// recognized native class — across connected AND disconnected states.
test.describe('Admin controls use native wp-admin styling', () => {
  const RECOGNIZED = ['button', 'button-primary', 'button-secondary', 'button-link', 'button-link-delete']
  const ALLOWLIST = ['notice-dismiss']

  function rawControls(page) {
    return page.$$eval(
      '.ploi-cache-admin button, .ploi-cache-admin a[role="button"], .ploi-cache-admin .button',
      (els, ok) =>
        els
          .filter((el) => !Array.from(el.classList).some((c) => ok.includes(c)))
          .map((el) => ({ tag: el.tagName.toLowerCase(), class: el.className, text: (el.textContent || '').trim().slice(0, 30) })),
      [...RECOGNIZED, ...ALLOWLIST]
    )
  }

  test('no raw controls — connected state', async ({ admin, rest }) => {
    await rest.seed()
    await admin.reload()
    await expect(admin.getByRole('button', { name: 'Disconnect' })).toBeVisible()
    const raw = await rawControls(admin)
    expect(raw, `Unstyled control(s): ${JSON.stringify(raw, null, 2)}`).toEqual([])
  })

  test('no raw controls — disconnected state', async ({ admin, rest }) => {
    await rest.reset()
    await admin.reload()
    const raw = await rawControls(admin)
    expect(raw, `Unstyled control(s): ${JSON.stringify(raw, null, 2)}`).toEqual([])
  })
})
