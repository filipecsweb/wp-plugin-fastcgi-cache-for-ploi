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

    // FIL-29: the smoke test above proves the controls aren't raw; it cannot judge
    // the red tint or the decorative icons, which this test asserts against the live
    // render — including the one real trap, an icon clobbered by x-text.
    test('FIL-29 — Disconnect is tinted destructive; Change/Flush now carry decorative icons', async ({ connected, admin, settings }) => {
      // Disconnect keeps the recognized `.button` chrome but is tinted red on both text
      // and border, distinct from the untinted secondary buttons.
      await expect(settings.disconnectButton).toBeVisible()
      await expect(settings.disconnectButton).toHaveClass(/(?:^|\s)button(?:\s|$)/)
      const tint = await settings.disconnectColorFacts()
      expect(tint.color).toBe(tint.redRef)
      expect(tint.borderColor).toBe(tint.redRef)
      expect(tint.color).not.toBe(tint.neutralColor)

      // Change: the decorative pencil survives Alpine's render. x-text sits on an inner
      // label span (not the button), so it can't clobber the sibling icon; the icon is
      // aria-hidden, so the button's accessible name is unchanged. The button is located
      // by its icon (structure), so a dropped aria-hidden fails the name check below with
      // a labelled assertion, not a locator timeout.
      await expect(settings.changeIcon).toBeVisible()
      await expect(settings.changeIcon).toHaveAttribute('aria-hidden', 'true')
      await expect(settings.changeButton).toHaveAccessibleName('Change')

      // Flip canFlush to its false branch to force a real x-text re-render (canFlush is a
      // getter over saved.siteId), then back — the pencil must survive both. The initial
      // render alone wouldn't catch an icon clobbered only on a later label change.
      const savedSiteId = await admin.evaluate(() => {
        const d = window.Alpine.$data(document.querySelector('[x-data*=ploiCache]'))
        const prev = d.saved.siteId
        d.saved.siteId = null
        return prev
      })
      await expect(settings.changeButton).toHaveAccessibleName('Select target')
      await expect(settings.changeIcon).toBeVisible()
      await admin.evaluate((siteId) => {
        window.Alpine.$data(document.querySelector('[x-data*=ploiCache]')).saved.siteId = siteId
      }, savedSiteId)
      await expect(settings.changeButton).toHaveAccessibleName('Change')
      await expect(settings.changeIcon).toBeVisible()

      // Flush now: decorative refresh icon at rest; it hides while flushing so it never
      // sits beside the animated spinner (labels/busy behavior otherwise preserved).
      await expect(settings.flushNowIcon).toBeVisible()
      await expect(settings.flushNowIcon).toHaveAttribute('aria-hidden', 'true')
      await expect(settings.flushNowSpinner).toBeHidden()

      const setFlushBusy = (v) =>
        admin.evaluate((busy) => {
          window.Alpine.$data(document.querySelector('[x-data*=ploiCache]')).busy.flush = busy
        }, v)
      await setFlushBusy(true)
      await expect(settings.flushNowIcon).toBeHidden()
      await expect(settings.flushNowSpinner).toBeVisible()
      await setFlushBusy(false)
      await expect(settings.flushNowIcon).toBeVisible()
    })
  })
})
