import { test, expect } from '@playwright/test'

const ADMIN_USER = process.env.WP_ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.WP_ADMIN_PASS || 'password'

async function login(page) {
  await page.goto('/wp-login.php')
  await page.fill('#user_login', ADMIN_USER)
  await page.fill('#user_pass', ADMIN_PASS)
  await page.click('#wp-submit')
  await expect(page).toHaveURL(/wp-admin/)
}

test.describe('Ploi FastCGI Cache settings screen', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/wp-admin/options-general.php?page=ploi-fastcgi-cache')
  })

  test('renders the live Alpine shell', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ploi FastCGI Cache' })).toBeVisible()
    await expect(page.locator('.ploi-cache-admin')).toBeVisible()
    await expect(page.locator('.ploi-cache-admin input[type="password"]')).toBeVisible()
  })

  test('renders all six event toggles from the localized config', async ({ page }) => {
    await expect(page.locator('.ploi-cache-admin input[type="checkbox"]')).toHaveCount(6)
  })

  test('disables "Flush now" until configured, with a reason', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Flush now/i })).toBeDisabled()
    await expect(page.locator('.ploi-cache-admin')).toContainText(/Add a Ploi API token first|Choose a server and site/i)
  })

  test('rejects an invalid coalesce window', async ({ page }) => {
    const input = page.locator('#ploi-debounce')
    await input.fill('999')
    await input.blur()
    await expect(page.getByRole('button', { name: /Save settings/i })).toBeDisabled()
  })
})
