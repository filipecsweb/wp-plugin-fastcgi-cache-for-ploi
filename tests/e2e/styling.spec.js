import { test, expect } from './support/fixtures.js'
import { TOKENS } from './support/config.js'

// Page sanity + the CLAUDE.md-mandated styling smoke test. Tailwind preflight is OFF
// on this screen, so any control without a native wp-admin class renders raw; the
// smoke test fails if ANY actionable control lacks a recognized class.
const RECOGNIZED = ['button', 'button-primary', 'button-secondary', 'button-link', 'button-link-delete', 'button-small', 'nav-tab', 'nav-tab-active']
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

test.describe('Admin UI', () => {
  test('renders the live Alpine shell, the six event toggles, and the tab nav', async ({ admin, settings }) => {
    await expect(settings.heading).toBeVisible()
    await expect(settings.tokenInput).toBeVisible()
    await expect(settings.eventCheckboxes).toHaveCount(6)
    await expect(settings.settingsTab).toBeVisible()
    await expect(settings.logsTab).toBeVisible()
  })

  test('switches tabs and reflects the active tab in the URL hash', async ({ admin, settings }) => {
    await expect(settings.recentFlushesHeading).toBeHidden()

    await settings.logsTab.click()
    await expect(settings.recentFlushesHeading).toBeVisible()
    await expect(settings.tokenInput).toBeHidden()
    await expect(admin).toHaveURL(/#logs$/)

    await settings.settingsTab.click()
    await expect(settings.tokenInput).toBeVisible()
    await expect(admin).toHaveURL(/#settings$/)
  })

  test('the encryption-key notice visibility mirrors the server keyWarning flag', async ({ admin, settings }) => {
    const flag = await admin.evaluate(() => !!window.PloiCacheConfig.keyWarning)
    if (flag) await expect(settings.keyWarningBanner).toBeVisible()
    else await expect(settings.keyWarningBanner).toBeHidden()
  })

  test.describe('native wp-admin styling (preflight is OFF)', () => {
    test.skip(!TOKENS.good, 'the connected-state styling check needs the good token')

    test('no raw controls — connected state', async ({ connected, admin, settings }) => {
      await expect(settings.disconnectButton).toBeVisible()
      const raw = await rawControls(admin)
      expect(raw, `Unstyled control(s): ${JSON.stringify(raw, null, 2)}`).toEqual([])
    })

    test('no raw controls — disconnected state', async ({ connected, admin, api, settings }) => {
      await api.disconnect()
      await admin.reload()
      await expect(settings.connectButton).toBeVisible()
      const raw = await rawControls(admin)
      expect(raw, `Unstyled control(s): ${JSON.stringify(raw, null, 2)}`).toEqual([])
      // The `connected` fixture reconnects + restores the target in teardown.
    })
  })
})
