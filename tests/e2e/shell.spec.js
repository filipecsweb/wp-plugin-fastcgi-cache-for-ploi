import { test, expect } from './support/fixtures.js'

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

    await settings.logsTab.click()
    await expect(settings.logsTab).toHaveAttribute('aria-selected', 'true')
    await expect(settings.settingsTab).toHaveAttribute('aria-selected', 'false')
    await expect(admin).toHaveURL(/#logs$/)

    await admin.reload()
    await expect(settings.logsTab).toHaveAttribute('aria-selected', 'true')
    await expect(settings.settingsTab).toHaveAttribute('aria-selected', 'false')
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
