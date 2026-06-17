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

export default function ploiCache() {
  const cfg = window.PloiCacheConfig || {}
  const s = cfg.settings || {}

  return {
    cfg,

    // Active tab (client-side; the page never reloads). Seeded from the URL hash
    // and kept in sync with it (see init), so refresh + shared links are stable.
    activeTab: initialTab(cfg),

    // Editable working copy.
    token: '',
    serverId: s.serverId || '',
    siteId: s.siteId || '',
    enabled: { ...(s.enabledEvents || {}) },
    debounce: s.debounce ?? cfg.debounceDefault,

    // Fetched from Ploi.
    servers: [],
    sites: [],

    // Saved snapshot (what flushing uses).
    saved: {
      hasToken: !!s.hasToken,
      serverId: s.serverId || '',
      serverName: s.serverName || '',
      siteId: s.siteId || '',
      siteDomain: s.siteDomain || '',
    },
    needsReconnect: !!s.needsReconnect,
    keyWarning: !!cfg.keyWarning,
    // A saved token that Ploi rejected on a live call (401/403). Presence ≠ validity:
    // hasToken means "a token is stored", this means "stored but unusable right now".
    tokenRejected: false,

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

    // --- derived state ---
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

    // --- notices ---
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
      // Fresh snapshot adopted; any prior rejection is re-derived by the next load.
      this.tokenRejected = false
    },

    // The single place that reconciles the fetched server/site lists with the
    // saved connection. Called whenever the token state may have changed (init,
    // save), so the dropdowns can never silently drift from the saved token.
    async refreshConnection() {
      this.servers = []
      this.sites = []
      if (this.saved.hasToken && !this.needsReconnect) {
        await this.loadServers() // loads sites too when the saved serverId matches
      }
    },

    // --- REST ---
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

    // --- actions ---
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

    // Two-step destructive confirm for removing the saved token.
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

    async loadServers() {
      this.busy.servers = true
      try {
        const data = await this.api('GET', '/servers')
        this.servers = data.servers || []
        this.tokenRejected = false
        if (this.serverId && this.servers.some((x) => String(x.id) === String(this.serverId))) {
          await this.loadSites()
        }
      } catch (e) {
        // A failed fetch must not leave stale options behind — empty the
        // dropdowns and, on an auth failure, mark the saved token rejected.
        this.servers = []
        this.sites = []
        if (e.status === 401 || e.status === 403) this.tokenRejected = true
        this.handleError(e)
      } finally {
        this.busy.servers = false
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
        this.sites = []
        if (e.status === 401 || e.status === 403) this.tokenRejected = true
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
        // One coherent outcome: a rejection (notice already set by the failed
        // reload) outranks the target-cleared warning, which outranks success —
        // never "Saved!" immediately contradicted by an error.
        if (this.tokenRejected) {
          // refreshConnection() surfaced the rejection notice; leave it.
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
        // FlushController always returns a success message; no client fallback.
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
