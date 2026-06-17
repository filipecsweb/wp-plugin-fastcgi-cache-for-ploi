import { expect } from '@playwright/test'
import { SETTINGS_PATH } from './config.js'

/**
 * Page Object for the FastCGI Cache for Ploi settings screen. Locators favour
 * roles/labels and stable structure over brittle CSS, and are re-derived from the
 * live accessibility tree (see docs/e2e-tests.md "How the suite was built").
 *
 * Note on names: the connect/disconnect buttons share the substring "connect", so
 * those use exact matching; the Site <select>'s accessible name absorbs its hint
 * text, so the modal selects are addressed by position within the dialog.
 */
export class SettingsPage {
  constructor(page) {
    this.page = page
    this.root = page.locator('.ploi-cache-admin')

    this.heading = page.getByRole('heading', { name: 'FastCGI Cache for Ploi' })
    this.tokenInput = this.root.locator('input[type="password"]')
    this.connectButton = this.root.getByRole('button', { name: 'Connect', exact: true })
    this.disconnectButton = this.root.getByRole('button', { name: 'Disconnect', exact: true })
    this.targetButton = this.root.getByRole('button', { name: /^(Select target|Change)$/ })
    this.flushNowButton = this.root.getByRole('button', { name: /^Flush now/ })
    this.saveSettingsButton = this.root.getByRole('button', { name: 'Save settings' })
    this.eventCheckboxes = this.root.locator('input[type="checkbox"]')

    this.settingsTab = page.getByRole('tab', { name: 'Settings' })
    this.logsTab = page.getByRole('tab', { name: 'Logs' })
    this.recentFlushesHeading = page.getByRole('heading', { name: 'Recent flushes' })

    // Change-target modal.
    this.modal = page.getByRole('dialog', { name: 'Change flush target' })
    this.serverSelect = this.modal.getByRole('combobox').first()
    this.siteSelect = this.modal.getByRole('combobox').nth(1)
    this.saveTargetButton = this.modal.getByRole('button', { name: 'Save target' })
    this.cancelButton = this.modal.getByRole('button', { name: 'Cancel' })

    // Transient toasts vs the persistent reconnect banner. Toasts are dismissible
    // notices; the banner is an inline, non-dismissible notice.
    this.errorToast = this.root.locator('.notice.is-dismissible.notice-error')
    this.successToast = this.root.locator('.notice.is-dismissible.notice-success')
    this.reconnectBanner = this.root.getByText('Reconnect required.')
    this.keyWarningBanner = this.root.getByText("Harden your token's encryption key")
  }

  async goto() {
    await this.page.goto(SETTINGS_PATH)
    await expect(this.root).toBeVisible()
  }

  /** The live Alpine component state — the source of truth for non-visual assertions. */
  state() {
    return this.page.evaluate(() => {
      const d = window.Alpine.$data(document.querySelector('[x-data*=ploiCache]'))
      return {
        hasToken: d.hasToken,
        needsReconnect: d.needsReconnect,
        canFlush: d.canFlush,
        serverId: d.serverId,
        siteId: d.siteId,
        saved: { ...d.saved },
        servers: d.servers.map((x) => String(x.id)),
        sites: d.sites.map((x) => String(x.id)),
        serversLoaded: d.serversLoaded,
        targetModalOpen: d.targetModalOpen,
      }
    })
  }

  async connect(token) {
    await this.tokenInput.fill(token)
    await this.connectButton.click()
  }

  async openTargetModal() {
    await this.targetButton.click()
    await expect(this.modal).toBeVisible()
    // The modal lazy-loads its lists; wait for the probe to finish populating them
    // (serversLoaded flips true on success — set false at the start of the load, so
    // this can't pass prematurely).
    await this.page.waitForFunction(() => {
      const d = window.Alpine.$data(document.querySelector('[x-data*=ploiCache]'))
      return d.serversLoaded
    })
  }

  /**
   * Select the first server option (optionally skipping one) that has at least one
   * site, waiting on Alpine's busy state rather than a timer. Returns its id.
   */
  async selectServerWithSites(excludeServerId = null) {
    const values = await this.serverSelect
      .locator('option')
      .evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean))

    for (const value of values) {
      if (excludeServerId != null && String(value) === String(excludeServerId)) continue
      await this.serverSelect.selectOption(value)
      await this.page.waitForFunction(() => {
        const d = window.Alpine.$data(document.querySelector('[x-data*=ploiCache]'))
        return d.serverId && !d.busy.sites
      })
      const count = await this.page.evaluate(
        () => window.Alpine.$data(document.querySelector('[x-data*=ploiCache]')).sites.length
      )
      if (count > 0) return String(value)
    }
    throw new Error('[e2e] No server with at least one site is available in the modal.')
  }

  /** Pick the first available server+site and return the chosen {serverId, siteId}. */
  async chooseFirstAvailableTarget() {
    await this.selectServerWithSites()
    await this.siteSelect.selectOption({ index: 1 })
    const s = await this.state()
    return { serverId: s.serverId, siteId: s.siteId }
  }
}
