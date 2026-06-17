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
  test('enable all / disable all toggle every event', async ({ admin }) => {
    const root = admin.locator('.ploi-cache-admin')
    const checks = root.locator('input[type="checkbox"]')

    await root.getByRole('button', { name: 'Disable all' }).click()
    for (const check of await checks.all()) await expect(check).not.toBeChecked()

    await root.getByRole('button', { name: 'Enable all' }).click()
    for (const check of await checks.all()) await expect(check).toBeChecked()

    await checks.first().uncheck()
    await expect(checks.first()).not.toBeChecked()
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
    // The saved snapshot (debounce + flush target) hydrates from the server. The
    // seed token is a fake string, so the live token check flags it rejected —
    // but a token IS saved (Disconnect offered) and the target still hydrates.
    await expect(admin.locator('#ploi-debounce')).toHaveValue('7')
    await expect(admin.getByRole('button', { name: 'Disconnect' })).toBeVisible()
    await expect(admin.locator('.ploi-cache-admin')).toContainText('Currently flushing:')
  })

  test('a token with no server/site is not a flushable config (§6)', async ({ admin, rest }) => {
    await rest.seed({ server_id: '', site_id: '' })
    await admin.reload()
    await expect(admin.getByRole('button', { name: /Flush now/i })).toBeDisabled()
    await expect(admin.locator('.ploi-cache-admin')).toContainText(/Choose a server and site/i)
  })
})

test.describe('Settings screen — tabs', () => {
  test('switches between Settings and Logs, persisting the active tab in the URL hash', async ({ admin }) => {
    const root = admin.locator('.ploi-cache-admin')
    const recentFlushes = admin.getByRole('heading', { name: 'Recent flushes' })
    const tokenField = root.locator('input[type="password"]')

    // Settings is active by default: its content shows, the Logs content is hidden.
    await expect(tokenField).toBeVisible()
    await expect(recentFlushes).toBeHidden()

    // Switch to Logs: its content shows, Settings hides, and the hash reflects it.
    await admin.getByRole('tab', { name: 'Logs' }).click()
    await expect(recentFlushes).toBeVisible()
    await expect(tokenField).toBeHidden()
    await expect(admin).toHaveURL(/#logs$/)

    // The active tab survives a full reload (read back from the hash).
    await admin.reload()
    await expect(admin.getByRole('heading', { name: 'Recent flushes' })).toBeVisible()
    await expect(admin.locator('.ploi-cache-admin input[type="password"]')).toBeHidden()

    // Back to Settings.
    await admin.getByRole('tab', { name: 'Settings' }).click()
    await expect(admin.locator('.ploi-cache-admin input[type="password"]')).toBeVisible()
    await expect(admin).toHaveURL(/#settings$/)
  })

  test('stays on the Settings tab after saving', async ({ admin }) => {
    const root = admin.locator('.ploi-cache-admin')

    await root.getByRole('button', { name: 'Disable all' }).click()
    const debounce = admin.locator('#ploi-debounce')
    await debounce.fill('0')
    await debounce.blur()
    await admin.getByRole('button', { name: /Save settings/i }).click()
    await expect(root).toContainText('Settings saved.')

    // Still on Settings: its content is visible and the tab is marked active.
    await expect(debounce).toBeVisible()
    await expect(admin.getByRole('tab', { name: 'Settings' })).toHaveClass(/nav-tab-active/)
  })
})

// Tailwind preflight is OFF on this screen, so a newly added control renders raw
// until given a native wp-admin class. Fails if ANY actionable control carries no
// recognized native class — across connected AND disconnected states.
test.describe('Admin controls use native wp-admin styling', () => {
  const RECOGNIZED = ['button', 'button-primary', 'button-secondary', 'button-link', 'button-link-delete', 'nav-tab', 'nav-tab-active']
  const ALLOWLIST = ['notice-dismiss']

  function rawControls(page) {
    return page.$$eval(
      '.ploi-cache-admin button, .ploi-cache-admin a[role="button"], .ploi-cache-admin .button, .ploi-cache-admin .nav-tab',
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
