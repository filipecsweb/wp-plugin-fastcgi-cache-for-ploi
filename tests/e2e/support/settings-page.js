import { expect } from '@playwright/test'
import { SETTINGS_PATH } from './config.js'

/**
 * Page Object for the FastCGI Cache for Ploi settings screen. Locators favour
 * roles/labels and stable structure over brittle CSS, and are re-derived from the
 * live accessibility tree — re-derive from a live session (playwright-cli) if the
 * admin UI changes.
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
    // FIL-29 decorative dashicons: aria-hidden, so they don't alter the buttons'
    // accessible names above. Both the change/flush buttons and their icons are anchored
    // on the unique dashicon (structure, NOT accessible name): the change button's name
    // flips Change↔Select target with canFlush and the flush button's flips to "Flushing…"
    // while busy, either of which would break a name-based locator mid-test. Anchoring on
    // `:has(.dashicons-*)` also lets a dropped aria-hidden fail with a labelled assertion
    // rather than a name-mismatch timeout. The spinner is the child the flush icon swaps
    // with, keyed by its x-show.
    this.changeButton = this.root.locator('button:has(.dashicons-edit)')
    this.changeIcon = this.changeButton.locator('.dashicons-edit')
    this.flushNowIcon = this.root.locator('.dashicons-update')
    this.flushNowSpinner = this.root.locator('button:has(.dashicons-update) [x-show="busy.flush"]')
    this.saveSettingsButton = this.root.getByRole('button', { name: 'Save settings' })
    this.eventCheckboxes = this.root.locator('input[type="checkbox"]')

    this.settingsTab = page.getByRole('tab', { name: 'Settings' })
    this.logsTab = page.getByRole('tab', { name: 'Logs' })
    this.recentFlushesHeading = page.getByRole('heading', { name: 'Recent flushes' })
    // The "Recent flushes" audit table and its rows (newest first). The manual
    // Refresh button re-reads the log on demand; specs that assert an automatic
    // refresh must never click it.
    this.logTable = this.root.locator('table.wp-list-table')
    this.logRows = this.logTable.locator('tbody tr')
    this.logRefreshButton = this.root.getByRole('button', { name: 'Refresh' })
    // The per-row "?" hint trigger and its (position:fixed) tooltip panel. Scoped to
    // :visible so `.first()` lands on a shown hint (success rows keep a hidden trigger)
    // and, after hover, on the one actually open.
    this.logHintButtons = this.logTable.locator('tbody .button-link:visible')
    this.logTooltips = this.logTable.locator('tbody span[x-text="entry.hint"]:visible')

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
        reconnectReason: d.reconnectReason,
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

  /**
   * Live view of the shared `log` state — the source of truth for asserting a
   * refresh happened. `topId` is the newest row's id (null when empty); a change in
   * it proves the table re-read without a manual Refresh/reload.
   */
  logState() {
    return this.page.evaluate(() => {
      const d = window.Alpine.$data(document.querySelector('[x-data*=ploiCache]'))
      return { length: d.log.length, topId: d.log[0] ? d.log[0].id : null, busy: d.busy.flush }
    })
  }

  /**
   * Geometry + sticky-header facts for the Recent flushes scroll container (FIL-22).
   * The container is the <div> that directly wraps the (single) wp-list-table.
   */
  logMetrics() {
    return this.page.evaluate(() => {
      const table = document.querySelector('.ploi-cache-admin table.wp-list-table')
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
        // At-rest top-rule facts (Defect 1 / follow-up 2): the single source is the
        // thead's inset box-shadow; the table must carry NO competing border-top, else
        // the rule doubles at rest and changes when scrolled.
        theadBoxShadowAtRest: getComputedStyle(table.querySelector('thead')).boxShadow,
        tableBorderTopWidth: getComputedStyle(table).borderTopWidth,
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
      const table = document.querySelector('.ploi-cache-admin table.wp-list-table')
      const wrap = table.parentElement
      const thead = table.querySelector('thead')
      wrap.scrollTop = Math.floor((wrap.scrollHeight - wrap.clientHeight) / 2)
      const wRect = wrap.getBoundingClientRect()
      const tRect = thead.getBoundingClientRect()
      const style = getComputedStyle(thead)
      const bg = style.backgroundColor
      const alpha = bg.startsWith('rgba') ? parseFloat(bg.split(',')[3]) : 1
      return {
        scrolled: wrap.scrollTop > 0,
        headerPinnedToContainerTop: Math.abs(tRect.top - wRect.top) < 2,
        theadOpaque: alpha === 1,
        // Defect 1: a top rule that lives on the sticky element (inset box-shadow) and
        // therefore stays visible while the body scrolls under it.
        theadBoxShadow: style.boxShadow,
        theadHasStickyRule: style.boxShadow !== 'none' && /inset/.test(style.boxShadow),
      }
    })
  }

  /**
   * Focus a hint whose row is below the container fold, so the browser's focus
   * auto-scroll reveals it. Returns whether the container actually auto-scrolled (the
   * precondition for exercising the scroll-dismiss grace window).
   */
  focusHintBelowFold() {
    return this.page.evaluate(() => {
      const table = document.querySelector('.ploi-cache-admin table.wp-list-table')
      const wrap = table.parentElement
      wrap.scrollTop = 0
      const foldBottom = wrap.getBoundingClientRect().bottom
      const btn = [...table.querySelectorAll('tbody .button-link')].find((b) => b.getBoundingClientRect().top > foldBottom)
      if (!btn) return { found: false, autoScrolled: false }
      const before = wrap.scrollTop
      btn.focus()
      return { found: true, autoScrolled: wrap.scrollTop !== before }
    })
  }

  /**
   * Anchor geometry of the currently-open hint tooltip vs its trigger (FIL-22). The
   * fixed panel must sit centred on and just below the "?" — a regression that stranded
   * it (e.g. at 0,0) would still pass the visible / fixed / no-h-scroll checks.
   */
  tooltipAnchor() {
    return this.page.evaluate(() => {
      const panel = [...document.querySelectorAll('.ploi-cache-admin table.wp-list-table tbody span[x-text="entry.hint"]')].find(
        (el) => getComputedStyle(el).display !== 'none'
      )
      if (!panel) return null
      const btn = panel.closest('[x-data]').querySelector('.button-link')
      const p = panel.getBoundingClientRect()
      const b = btn.getBoundingClientRect()
      return {
        centerDeltaX: Math.abs(p.left + p.width / 2 - (b.left + b.width / 2)),
        verticalGap: p.top - b.bottom,
      }
    })
  }

  /**
   * Container horizontal-overflow facts (Defect 2). A wide hint tooltip must not grow
   * the scroll container's scrollWidth — `overflow-y:auto` implies `overflow-x:auto`,
   * so an in-container tooltip that spilled past the right edge would add a horizontal
   * scrollbar. The tooltip escapes via position:fixed, so scrollWidth stays == clientWidth.
   */
  logContainerOverflow() {
    return this.page.evaluate(() => {
      const wrap = document.querySelector('.ploi-cache-admin table.wp-list-table').parentElement
      return { scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth, scrollsHorizontally: wrap.scrollWidth > wrap.clientWidth }
    })
  }

  /**
   * FIL-29 destructive-tint facts: the Disconnect button's computed text/border
   * colour vs a neutral secondary `.button`. The tint is a `tw:` colour utility with
   * the `!` variant (wp-admin's `.button` colour is unlayered and would otherwise
   * win), so a working tint reads as a red distinct from the untinted buttons.
   */
  disconnectColorFacts() {
    return this.page.evaluate(() => {
      const btn = (re) => [...document.querySelectorAll('.ploi-cache-admin button')].find((b) => re.test(b.textContent) && b.offsetParent !== null)
      const disconnect = getComputedStyle(btn(/Disconnect/))
      // Match the busy label too, so this stays robust if ever read mid-flush.
      const neutral = getComputedStyle(btn(/Flush now|Flushing/))
      // Reference red from a throwaway node carrying the same utility, so the check is
      // "Disconnect is red-600" regardless of how this browser serialises the colour.
      const probe = document.createElement('span')
      probe.className = 'tw:text-red-600!'
      document.querySelector('.ploi-cache-admin').appendChild(probe)
      const redRef = getComputedStyle(probe).color
      probe.remove()
      return { color: disconnect.color, borderColor: disconnect.borderColor, neutralColor: neutral.color, redRef }
    })
  }

  /** Resolve once a full flush cycle (including the finally-block loadLog) has settled. */
  async waitForFlushSettled() {
    await this.page.waitForFunction(() => {
      const d = window.Alpine.$data(document.querySelector('[x-data*=ploiCache]'))
      return d.busy.flush === false
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
