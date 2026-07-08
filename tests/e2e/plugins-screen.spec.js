import { test, expect } from './support/fixtures.js'
import { PLUGINS_PATH } from './support/config.js'

// The Settings action link (FIL-25). Located by href, not label, so the spec
// holds under any site locale; the label itself is asserted via the accessible
// name of that same element.
test.describe('Plugins screen', () => {
  test('the plugin row links to the settings page ahead of Deactivate', async ({ admin, settings }) => {
    await admin.goto(PLUGINS_PATH)

    const row = admin.locator('tr[data-slug="fastcgi-cache-for-ploi"]')
    await expect(row).toBeVisible()

    const actions = row.locator('.row-actions')
    const settingsLink = actions.locator('a[href*="page=fastcgi-cache-for-ploi"]')
    await expect(settingsLink).toHaveText(/\S/)

    // Core convention: Settings comes before Deactivate.
    const hrefs = await actions.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
    const settingsIndex = hrefs.findIndex((h) => h.includes('page=fastcgi-cache-for-ploi'))
    const deactivateIndex = hrefs.findIndex((h) => h.includes('action=deactivate'))
    expect(settingsIndex).toBeGreaterThanOrEqual(0)
    expect(deactivateIndex).toBeGreaterThan(settingsIndex)

    await settingsLink.click()
    await expect(admin).toHaveURL(/options-general\.php\?page=fastcgi-cache-for-ploi/)
    await expect(settings.heading).toBeVisible()
  })
})
