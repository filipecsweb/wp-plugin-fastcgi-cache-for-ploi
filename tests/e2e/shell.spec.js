import { test, expect } from './support/fixtures.js'
import { PLUGINS_PATH, SETTINGS_PATH } from './support/config.js'

// wp-admin chrome around the screen: toolbar, menu, page heading + description, footer.
const CHROME = ['#wpadminbar', '#adminmenu a', '.wrap > h1', '.wrap > p.description', '#wpfooter']

// WHY: core 6.6's own wp-element logs this under SCRIPT_DEBUG (its editors do too); it is not ours to fix.
const CORE_WARNINGS = [/importing createRoot from "react-dom"/]

test.describe('settings shell', () => {
  test('renders the screen from its config: token input, one toggle per event, the key warning', async ({ admin, settings }) => {
    await expect(settings.heading).toBeVisible()
    await expect(settings.tokenInput).toBeVisible()

    const cfg = await admin.evaluate(() => ({ events: window.PloiCacheConfig.events.length, keyWarning: !!window.PloiCacheConfig.keyWarning }))
    await expect(settings.eventCheckboxes).toHaveCount(cfg.events)
    if (cfg.keyWarning) await expect(settings.keyWarningBanner).toBeVisible()
    else await expect(settings.keyWarningBanner).toBeHidden()
  })

  test('switches tabs and reopens the hash tab on reload', async ({ admin, settings }) => {
    await expect(settings.settingsTab).toHaveAttribute('aria-selected', 'true')

    const fadedIn = admin.evaluate(
      () =>
        new Promise((resolve) => {
          document.addEventListener('transitionrun', (e) => e.target.getAttribute('role') === 'tabpanel' && e.propertyName === 'opacity' && resolve(true))
          setTimeout(() => resolve(false), 2000)
        })
    )
    await settings.logsTab.click()
    expect(await fadedIn).toBe(true)
    await expect(settings.logsTab).toHaveAttribute('aria-selected', 'true')
    await expect(settings.settingsTab).toHaveAttribute('aria-selected', 'false')
    await expect(admin).toHaveURL(/#logs$/)

    await admin.reload()
    await expect(settings.logsTab).toHaveAttribute('aria-selected', 'true')
    await expect(settings.settingsTab).toHaveAttribute('aria-selected', 'false')
  })

  test('keeps the desktop tabs and an inset card action at phone width', async ({ admin, settings }) => {
    await admin.setViewportSize({ width: 480, height: 900 })

    // WHY the landing tab: a clicked tab grows its bottom border through a transition, so measuring it races.
    const tabList = admin.getByRole('tablist')
    await expect(tabList).toHaveCSS('border-bottom-width', '1px')
    const list = await tabList.boundingBox()
    const active = await settings.settingsTab.boundingBox()
    expect(active.y + active.height).toBeCloseTo(list.y + list.height, 1)

    await settings.logsTab.click()
    const insets = await settings.logRefreshButton.evaluate((button) => {
      const header = button.closest('[data-slot="card-header"]')
      const outer = header.getBoundingClientRect()
      const inner = button.getBoundingClientRect()
      return [inner.top - outer.top, outer.bottom - parseFloat(getComputedStyle(header).borderBottomWidth) - inner.bottom, outer.right - inner.right]
    })
    insets.forEach((inset) => expect(inset).toBeCloseTo(8, 1))
  })

  test('hides admin notices from other code on this screen only', async ({ admin }) => {
    // CONTRACT: the cookie and id are the ones tests/e2e/support/foreign-notice.php reads and prints.
    await admin.context().addCookies([{ name: 'fastcgi_cache_for_ploi_e2e_notice', value: '1', url: admin.url() }])
    const notice = admin.locator('#fastcgi-cache-for-ploi-e2e-notice')

    await admin.goto(PLUGINS_PATH)
    await expect(notice, 'the fixture notice is missing: run tests/e2e/setup-site.sh against this site').toBeVisible()

    await admin.goto(SETTINGS_PATH)
    await expect(admin.locator('.ploi-cache-admin')).toBeVisible()
    await expect(notice).toHaveCount(0)
  })

  test('leaves the wp-admin chrome untouched', async ({ admin }) => {
    const chromeStyles = () =>
      admin.evaluate(
        (selectors) =>
          selectors.flatMap((selector) => {
            const style = getComputedStyle(document.querySelector(selector))
            // Custom properties are skipped: Tailwind's @property registrations are global by spec and paint nothing.
            return [...style].filter((prop) => !prop.startsWith('--')).map((prop) => `${selector} ${prop}: ${style.getPropertyValue(prop)}`)
          }),
        CHROME
      )

    // WHY: the screen's own height depends on our CSS, and it moves the footer's resolved `top`. Hide it for both reads.
    await admin.evaluate(() => document.querySelectorAll('.wrap > :not(h1, p.description)').forEach((el) => (el.style.display = 'none')))

    const withOurCss = await chromeStyles()
    const disabled = await admin.evaluate(() => {
      const links = [...document.querySelectorAll('link[rel="stylesheet"][href*="/fastcgi-cache-for-ploi/public/build/"]')]
      links.forEach((link) => (link.disabled = true))
      return links.length
    })
    const withoutOurCss = await chromeStyles()

    expect(disabled).toBeGreaterThan(0)
    expect(withOurCss.filter((line) => !withoutOurCss.includes(line))).toEqual([])
  })

  test('logs no console error of its own', async ({ admin, settings }) => {
    const errors = []
    admin.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
    admin.on('pageerror', (error) => errors.push(error.message))

    await admin.reload()
    await settings.logsTab.click()
    await expect(settings.logsTab).toHaveAttribute('aria-selected', 'true')

    expect(errors.filter((text) => !CORE_WARNINGS.some((known) => known.test(text)))).toEqual([])
  })
})
