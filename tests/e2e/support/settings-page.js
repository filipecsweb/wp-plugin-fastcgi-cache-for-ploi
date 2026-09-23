import { expect } from '@playwright/test'

/**
 * Page Object for the FastCGI Cache for Ploi settings screen. It reads state only
 * through roles, labels, `data-testid` and the root's `data-*` attributes (`attr()`),
 * never through the framework's internals.
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
    this.eventCheckboxes = this.root.getByRole('checkbox')

    this.settingsTab = page.getByRole('tab', { name: 'Settings' })
    this.logsTab = page.getByRole('tab', { name: 'Logs' })
    this.recentFlushesHeading = page.getByRole('heading', { name: 'Recent flushes' })
    // The "Recent flushes" audit table and its rows (newest first). The manual
    // Refresh button re-reads the log on demand; specs that assert an automatic
    // refresh must never click it.
    this.logTable = this.root.getByRole('table')
    this.logRows = this.logTable.locator('tbody tr')
    this.logRefreshButton = this.root.getByRole('button', { name: 'Refresh' })
    // The per-row "?" hint trigger and its tooltip panel. getByRole skips the hidden
    // triggers success rows keep, and the visible filter lands on the open panel.
    // Panels are looked up from the root: they are portalled out of the table.
    this.logHintButtons = this.logTable.locator('tbody').getByRole('button')
    this.logTooltips = this.root.getByTestId('log-hint').filter({ visible: true })

    // Change-target modal.
    this.modal = page.getByRole('dialog', { name: 'Change flush target' })
    this.serverSelect = this.modal.getByRole('combobox').first()
    this.siteSelect = this.modal.getByRole('combobox').nth(1)
    this.saveTargetButton = this.modal.getByRole('button', { name: 'Save target' })
    this.cancelButton = this.modal.getByRole('button', { name: 'Cancel' })

    // Transient toasts (by test id, since a UI may hide an error toast from the
    // accessibility tree until it is focused) vs the persistent reconnect banner.
    this.errorToast = this.root.getByTestId('toast-error')
    this.successToast = this.root.getByTestId('toast-success')
    this.reconnectBanner = this.root.getByText('Reconnect required.')
    this.keyWarningBanner = this.root.getByText("Harden your token's encryption key")
  }

  /** A root `data-*` attribute. Throws when a UI doesn't render it, so a gap in the contract fails loudly. */
  async attr(name) {
    const value = await this.root.getAttribute(`data-${name}`)
    if (value === null) throw new Error(`[e2e] The settings root has no data-${name} attribute.`)
    return value
  }

  /** Page-level state, for the non-visual assertions. */
  async state() {
    const reconnectReason = await this.attr('reconnect-reason')
    return {
      hasToken: (await this.attr('has-token')) === 'true',
      needsReconnect: reconnectReason !== '',
      reconnectReason,
      canFlush: (await this.attr('can-flush')) === 'true',
    }
  }

  /** The target modal's working copy, read from its pickers. Call it only while the modal is open. */
  async modalState() {
    return {
      serverId: await this.serverSelect.inputValue(),
      siteId: await this.siteSelect.inputValue(),
      servers: await this.optionValues(this.serverSelect),
    }
  }

  /**
   * The newest log row's id as the UI holds it ('' when empty), readable while the Logs
   * tab is hidden. A change proves the log re-read without a manual Refresh/reload.
   */
  async logState() {
    return { topId: await this.attr('log-top-id') }
  }

  optionValues(select) {
    return select.locator('option').evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean))
  }

  /**
   * Geometry + sticky-header facts for the Recent flushes scroll container (FIL-22).
   * The container is the <div> that directly wraps the (single) log table.
   */
  logMetrics() {
    return this.page.evaluate(() => {
      const table = document.querySelector('.ploi-cache-admin table')
      const wrap = table.parentElement
      const cs = getComputedStyle(wrap)
      return {
        renderedHeight: Math.round(wrap.getBoundingClientRect().height),
        contentHeight: wrap.scrollHeight,
        maxHeightPx: Math.round(parseFloat(cs.maxHeight)),
        overflowY: cs.overflowY,
        isScrollable: wrap.scrollHeight > wrap.clientHeight,
        theadPosition: getComputedStyle(table.querySelector('thead')).position,
        pageScrollsHorizontally: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })
  }

  /**
   * Scroll the log container to its midpoint and report whether the header stays
   * pinned to the container's top edge and is painted with an opaque background (so
   * scrolled rows can't bleed through it).
   */
  scrollLogAndCheckHeader() {
    return this.page.evaluate(() => {
      const table = document.querySelector('.ploi-cache-admin table')
      const wrap = table.parentElement
      const thead = table.querySelector('thead')
      wrap.scrollTop = Math.floor((wrap.scrollHeight - wrap.clientHeight) / 2)
      const wRect = wrap.getBoundingClientRect()
      const tRect = thead.getBoundingClientRect()
      const style = getComputedStyle(thead)
      const bg = style.backgroundColor
      // rgba(r, g, b, a) or a modern colour with "/ a": no alpha component means opaque.
      const alpha = parseFloat(/rgba\([^)]*,\s*([\d.]+)\)|\/\s*([\d.]+)\)/.exec(bg)?.slice(1).find(Boolean) ?? '1')
      return {
        scrolled: wrap.scrollTop > 0,
        headerPinnedToContainerTop: Math.abs(tRect.top - wRect.top) < 2,
        theadOpaque: alpha === 1,
      }
    })
  }

  /**
   * Tab to a hint whose row is below the container fold, so the browser's focus
   * auto-scroll reveals it. Returns whether the container actually auto-scrolled (the
   * precondition for exercising the scroll-dismiss grace window). Real Tab presses,
   * not element.focus(): a UI may open its tooltip on :focus-visible only.
   */
  async focusHintBelowFold() {
    const target = await this.page.evaluate(() => {
      const wrap = document.querySelector('.ploi-cache-admin table').parentElement
      wrap.scrollTop = 0
      const fold = wrap.getBoundingClientRect().bottom
      return [...wrap.querySelectorAll('tbody button')].findIndex((b) => b.getBoundingClientRect().top > fold)
    })
    if (target < 0) return { found: false, autoScrolled: false }

    await this.logRefreshButton.focus()
    for (let presses = 0; presses < 60; presses++) {
      await this.page.keyboard.press('Tab')
      const state = await this.page.evaluate((index) => {
        const wrap = document.querySelector('.ploi-cache-admin table').parentElement
        return { reached: document.activeElement === wrap.querySelectorAll('tbody button')[index], scrollTop: wrap.scrollTop }
      }, target)
      if (state.reached) return { found: true, autoScrolled: state.scrollTop > 0 }
    }
    return { found: false, autoScrolled: false }
  }

  /**
   * Anchor geometry of the open hint tooltip vs the `trigger` that opened it (FIL-22).
   * The panel must sit centred on and just below the "?" — a regression that stranded
   * it (e.g. at 0,0) would still pass the visible / no-h-scroll checks.
   */
  async tooltipAnchor(trigger) {
    const rect = (locator) => locator.evaluate((el) => el.getBoundingClientRect().toJSON())
    const p = await rect(this.logTooltips.first())
    const b = await rect(trigger)
    return {
      centerDeltaX: Math.abs(p.left + p.width / 2 - (b.left + b.width / 2)),
      verticalGap: p.top - b.bottom,
    }
  }

  /**
   * Container horizontal-overflow facts (Defect 2). A wide hint tooltip must not grow
   * the scroll container's scrollWidth — `overflow-y:auto` implies `overflow-x:auto`,
   * so an in-container tooltip that spilled past the right edge would add a horizontal
   * scrollbar. The tooltip is portalled out of the container, so scrollWidth stays == clientWidth.
   */
  logContainerOverflow() {
    return this.page.evaluate(() => {
      const wrap = document.querySelector('.ploi-cache-admin table').parentElement
      return { scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth, scrollsHorizontally: wrap.scrollWidth > wrap.clientWidth }
    })
  }

  /** Resolve once a full flush cycle (including the log reload that follows it) has settled. */
  async waitForFlushSettled() {
    await expect(this.root).toHaveAttribute('data-busy-flush', 'false')
  }

  async connect(token) {
    await this.tokenInput.fill(token)
    await this.connectButton.click()
  }

  async openTargetModal() {
    await this.targetButton.click()
    await expect(this.modal).toBeVisible()
    // The modal lazy-loads its lists. The server picker enables only once the probe has
    // returned servers and the saved server's sites are loaded, and it is disabled from
    // the moment the load starts, so this can't pass early.
    await expect(this.serverSelect).toBeEnabled()
  }

  /**
   * Select the first server option (optionally skipping one) that has at least one
   * site, waiting on the UI's busy state rather than a timer. Returns its id.
   */
  async selectServerWithSites(excludeServerId = null) {
    for (const value of await this.optionValues(this.serverSelect)) {
      if (excludeServerId != null && value === String(excludeServerId)) continue
      await this.serverSelect.selectOption(value)
      await expect(this.root).toHaveAttribute('data-busy-sites', 'false')
      if ((await this.optionValues(this.siteSelect)).length > 0) return value
    }
    throw new Error('[e2e] No server with at least one site is available in the modal.')
  }

  /** Pick the first available server+site and return the chosen {serverId, siteId}. */
  async chooseFirstAvailableTarget() {
    await this.selectServerWithSites()
    await this.siteSelect.selectOption({ index: 1 })
    const { serverId, siteId } = await this.modalState()
    return { serverId, siteId }
  }
}
