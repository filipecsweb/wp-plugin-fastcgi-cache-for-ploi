/**
 * Alpine component for the FastCGI Cache for Ploi settings screen.
 *
 * Hydrated from window.PloiCacheConfig. Talks to the plugin REST routes with the
 * wp_rest nonce. Distinguishes the SAVED snapshot (what auto-flush / manual flush
 * actually use) from the editable working copy, and surfaces both Ploi API errors
 * and the decrypt-failed reconnect path (HTTP 409 / code "needs_reconnect").
 */
// Resolve the tab to open on load: the URL hash if it names a known tab (so a
// refresh / shared link reopens it), else the first tab. cfg.tabs is the valid
// key list from SettingsPage::tabKeys().
function initialTab(cfg) {
  const keys = cfg.tabs || []
  const fromHash = (window.location.hash || '').replace(/^#/, '')
  return keys.includes(fromHash) ? fromHash : keys[0] || 'settings'
}

// A saved id/label pair as a single-option list — the floor each dropdown resets
// to, so the saved target is always a selected, visible option even before (or
// without) a live Ploi probe. Empty when nothing is saved.
function savedOption(id, labelKey, label) {
  return id ? [{ id, [labelKey]: label || id }] : []
}

export default function ploiCache() {
  const cfg = window.PloiCacheConfig || {}
  const s = cfg.settings || {}

  return {
    cfg,

    // Active tab (client-side; the page never reloads). Seeded from the URL hash
    // and kept in sync with it (see init), so refresh + shared links are stable.
    activeTab: initialTab(cfg),

    token: '',
    serverId: s.serverId || '',
    siteId: s.siteId || '',
    enabled: { ...(s.enabledEvents || {}) },
    debounce: s.debounce ?? cfg.debounceDefault,

    // From Ploi (GET /connection). Seeded with the saved target so it shows
    // selected on first paint; the probe then adds the other choices.
    servers: savedOption(s.serverId, 'name', s.serverName),
    sites: savedOption(s.siteId, 'domain', s.siteDomain),

    // WHY: separate from the working copy because flushing reads the persisted
    // snapshot, not edits in progress.
    saved: {
      hasToken: !!s.hasToken,
      serverId: s.serverId || '',
      serverName: s.serverName || '',
      siteId: s.siteId || '',
      siteDomain: s.siteDomain || '',
    },
    needsReconnect: !!s.needsReconnect,
    keyWarning: !!cfg.keyWarning,
    // Live health of the SAVED token, reconciled by refreshConnection() (load +
    // Save) off GET /connection — never by Test. Drives the status badge. Seeded
    // to 'checking' when a token is stored so the dot starts neutral (not green)
    // until verified. Values mirror ConnectionController's states + the JS-only
    // 'checking': absent | checking | ok | invalid | missing_permission | unknown.
    connectionState: s.hasToken ? 'checking' : 'absent',

    events: cfg.events || [],
    log: cfg.log || [],
    busy: { test: false, servers: false, sites: false, save: false, flush: false, log: false, disconnect: false },
    notice: null,
    confirmingDisconnect: false,

    init() {
      // Single reconcile path: load the dropdowns to match the saved connection.
      this.refreshConnection()
      // Reflect tab changes in the URL hash (refresh-safe, shareable) without
      // adding history entries or jumping the scroll position.
      this.$watch('activeTab', (tab) => {
        if (window.history.replaceState) {
          window.history.replaceState(null, '', `#${tab}`)
        } else {
          window.location.hash = tab
        }
      })
    },

    get hasToken() {
      return this.saved.hasToken
    },
    get canFlush() {
      return this.saved.hasToken && !!this.saved.serverId && !!this.saved.siteId && !this.needsReconnect
    },
    get flushDisabledReason() {
      if (this.needsReconnect) return this.cfg.i18n.reconnectShort
      if (!this.saved.hasToken) return this.cfg.i18n.needToken
      if (!this.saved.serverId || !this.saved.siteId) return this.cfg.i18n.needTarget
      return ''
    },
    get debounceValid() {
      const n = Number(this.debounce)
      return Number.isInteger(n) && n >= this.cfg.debounceMin && n <= this.cfg.debounceMax
    },
    // The one line of status copy, keyed by connectionState. Shared with the
    // after-Save notice (see save()), so the wording lives in exactly one place.
    get connectionMessage() {
      return this.cfg.i18n.connection[this.connectionState] || ''
    },
    // Dot colour per state; everything else (absent / checking / unknown) stays
    // neutral grey so a blip or an in-flight check never reads as good or bad.
    get connectionDot() {
      return (
        { ok: 'tw:bg-green-500', invalid: 'tw:bg-red-500', missing_permission: 'tw:bg-amber-500' }[
          this.connectionState
        ] || 'tw:bg-gray-300'
      )
    },

    setNotice(type, text) {
      this.notice = { type, text }
    },
    dismiss() {
      this.notice = null
    },
    handleError(e) {
      if (e.code === 'needs_reconnect' || e.status === 409) {
        this.needsReconnect = true
        this.saved.hasToken = false
      }
      this.setNotice('error', e.message)
    },

    // Adopt a server settings snapshot as the SAVED state (what flushing uses).
    // Single source for save(), disconnect(), and the token-downgrade path.
    adoptSaved(data) {
      this.saved = {
        hasToken: !!data.hasToken,
        serverId: data.serverId || '',
        serverName: data.serverName || '',
        siteId: data.siteId || '',
        siteDomain: data.siteDomain || '',
      }
      this.needsReconnect = !!data.needsReconnect
      // Fresh snapshot adopted; health is re-derived by refreshConnection() (Save)
      // or stays 'absent' after a disconnect (no token left to probe).
      this.connectionState = data.hasToken ? 'checking' : 'absent'
    },

    // Map a Ploi probe failure to a saved-token health state (401 invalid, 403
    // missing permission, else couldn't-verify). Used wherever a live call can
    // reveal the saved token's health: the load/Save reconcile and picking a server.
    applyProbeError(e) {
      this.connectionState = e.status === 401 ? 'invalid' : e.status === 403 ? 'missing_permission' : 'unknown'
    },

    // The single place that reconciles the saved connection's health AND the
    // server/site dropdowns. Called whenever the token state may have changed
    // (init, Save), so the badge and dropdowns never drift from the saved token.
    // GET /connection probes both required scopes and returns the lists, so it is
    // one round-trip — and Test never calls it, so testing can't move the badge.
    async refreshConnection() {
      if (!this.saved.hasToken || this.needsReconnect) {
        this.servers = []
        this.sites = []
        this.connectionState = 'absent'
        return
      }
      // Show the saved target while the probe is in flight; the response then
      // replaces these with the full lists.
      this.servers = this.savedServerFloor()
      this.sites = this.savedSiteFloor()
      this.connectionState = 'checking'
      this.busy.servers = true
      try {
        const data = await this.api('GET', '/connection')
        this.connectionState = data.state || 'unknown'
        this.servers = data.servers || []
        // Reuse the saved server's sites the probe already fetched; otherwise load
        // them when the saved server is present in the list.
        if (data.sites && data.sites.length && this.serverId) {
          this.sites = data.sites
        } else if (this.serverId && this.servers.some((x) => String(x.id) === String(this.serverId))) {
          await this.loadSites()
        }
      } catch (e) {
        // A decrypt-failure (409) routes to the reconnect banner (no target to
        // show); any other failure only colours the badge — no error toast on a
        // load the user didn't trigger — and the saved target stays visible.
        if (e.code === 'needs_reconnect' || e.status === 409) {
          this.needsReconnect = true
          this.saved.hasToken = false
          this.connectionState = 'absent'
          this.servers = []
          this.sites = []
        } else {
          this.applyProbeError(e)
        }
      } finally {
        this.busy.servers = false
      }
    },

    async api(method, path, body) {
      const res = await fetch(`${this.cfg.restUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': this.cfg.nonce },
        body: body ? JSON.stringify(body) : undefined,
      })

      let data = {}
      try {
        data = await res.json()
      } catch (e) {
        data = {}
      }

      if (!res.ok) {
        const err = new Error(data.message || this.cfg.i18n.genericError)
        err.code = data.code || ''
        err.status = res.status
        throw err
      }

      return data
    },

    // Validate ONLY — never persists the token and never loads the dropdowns.
    // An empty field re-checks the saved token (POST {}); the server tailors the
    // success message. Saving (below) is what actually stores the token.
    async testToken() {
      const entered = this.token.trim()
      if (!entered && !this.saved.hasToken) {
        this.setNotice('error', this.cfg.i18n.needToken)
        return
      }
      this.busy.test = true
      this.notice = null
      try {
        const data = await this.api('POST', '/connection/test', entered ? { token: entered } : {})
        this.setNotice('success', data.message)
      } catch (e) {
        this.handleError(e)
      } finally {
        this.busy.test = false
      }
    },

    askDisconnect() {
      this.confirmingDisconnect = true
    },
    cancelDisconnect() {
      this.confirmingDisconnect = false
    },
    async disconnect() {
      this.busy.disconnect = true
      this.notice = null
      try {
        const data = await this.api('DELETE', '/connection')
        // Adopt the server's fresh snapshot (token + target now empty), exactly
        // like save(), then clear the editable working copy + loaded lists.
        this.adoptSaved(data)
        this.token = ''
        this.serverId = ''
        this.siteId = ''
        this.servers = []
        this.sites = []
        this.confirmingDisconnect = false
        this.setNotice('success', this.cfg.i18n.disconnected)
      } catch (e) {
        this.handleError(e)
      } finally {
        this.busy.disconnect = false
      }
    },

    async loadSites() {
      if (!this.serverId) {
        this.sites = []
        return
      }
      this.busy.sites = true
      try {
        const data = await this.api('GET', `/servers/${encodeURIComponent(this.serverId)}/sites`)
        this.sites = data.sites || []
      } catch (e) {
        // No stale options: fall back to the saved site (only when this IS the
        // saved server). An auth/scope failure also reflects in the badge.
        this.sites = this.savedSiteFloor()
        this.applyProbeError(e)
        this.handleError(e)
      } finally {
        this.busy.sites = false
      }
    },

    onServerChange() {
      this.siteId = ''
      this.sites = []
      if (this.serverId) this.loadSites()
    },

    // The saved target as a one-option floor for each dropdown, so the saved
    // selection stays visible while a probe is in flight or after it fails. The
    // site floor only applies on the saved server (its site belongs to it).
    savedServerFloor() {
      return savedOption(this.saved.serverId, 'name', this.saved.serverName)
    },
    savedSiteFloor() {
      return String(this.serverId) === String(this.saved.serverId)
        ? savedOption(this.saved.siteId, 'domain', this.saved.siteDomain)
        : []
    },

    selectedServerName() {
      const found = this.servers.find((x) => String(x.id) === String(this.serverId))
      return found ? found.name : this.saved.serverName
    },
    selectedSiteDomain() {
      const found = this.sites.find((x) => String(x.id) === String(this.siteId))
      return found ? found.domain : this.saved.siteDomain
    },

    async save() {
      if (!this.debounceValid) {
        this.setNotice('error', this.cfg.i18n.badDebounce)
        return
      }
      this.busy.save = true
      this.notice = null
      try {
        const submitted = this.token.trim()
        const data = await this.api('POST', '/settings', {
          token: submitted || undefined,
          server_id: this.serverId,
          site_id: this.siteId,
          server_name: this.selectedServerName(),
          site_domain: this.selectedSiteDomain(),
          events: this.enabled,
          debounce: Number(this.debounce),
        })
        this.adoptSaved(data)
        this.token = ''
        // Server cleared a target the new token can't use (downgrade / different
        // account): drop the now-invalid working selection too.
        if (data.targetCleared) {
          this.serverId = ''
          this.siteId = ''
          this.sites = []
        }
        // Reconcile the dropdowns with the (possibly new) saved token. The guard
        // skips a needless Ploi refetch when only events/debounce changed.
        if (submitted || this.servers.length === 0) {
          await this.refreshConnection()
        }
        // One coherent outcome: a token-health problem outranks a cleared target,
        // which outranks success — never "Saved!" contradicted by a red/amber dot.
        // refreshConnection() set connectionState; reuse its copy for the notice.
        if (this.connectionState === 'invalid' || this.connectionState === 'missing_permission') {
          this.setNotice('error', this.connectionMessage)
        } else if (data.targetCleared) {
          this.setNotice('warning', data.message)
        } else {
          this.setNotice('success', this.cfg.i18n.saved)
        }
      } catch (e) {
        this.handleError(e)
      } finally {
        this.busy.save = false
      }
    },

    async flushNow() {
      this.busy.flush = true
      this.notice = null
      try {
        const data = await this.api('POST', '/flush', {})
        // CONTRACT: FlushController always returns data.message on success, so no client fallback.
        this.setNotice('success', data.message)
        await this.loadLog()
      } catch (e) {
        this.handleError(e)
      } finally {
        this.busy.flush = false
      }
    },

    async loadLog() {
      this.busy.log = true
      try {
        const data = await this.api('GET', '/log')
        this.log = data.entries || []
      } catch (e) {
        this.handleError(e)
      } finally {
        this.busy.log = false
      }
    },

    setAllEvents(value) {
      this.events.forEach((event) => {
        this.enabled[event.key] = value
      })
    },
  }
}
