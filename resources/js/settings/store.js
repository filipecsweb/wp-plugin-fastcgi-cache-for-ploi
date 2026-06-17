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

    token: '',
    serverId: s.serverId || '',
    siteId: s.siteId || '',
    enabled: { ...(s.enabledEvents || {}) },
    debounce: s.debounce ?? cfg.debounceDefault,

    // Loaded from Ploi (GET /connection) only when the change-target modal opens.
    servers: [],
    sites: [],

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

    events: cfg.events || [],
    log: cfg.log || [],
    busy: { connect: false, servers: false, sites: false, save: false, flush: false, log: false, disconnect: false, target: false },
    notice: null,
    targetModalOpen: false,
    // The change-target modal's own error line (its server/site lists couldn't
    // load). Separate from `notice` because a page notice sits behind the overlay.
    targetError: '',

    init() {
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
    },

    // The specific reason a Ploi list call failed, for the modal's inline error:
    // 401 → invalid token, 403 → missing scope, anything else → couldn't reach Ploi.
    // The GET /connection probe reports the same reasons as a `state` (no HTTP
    // error), so its keys match this map.
    targetErrorFor(e) {
      const key = e.status === 401 ? 'invalid' : e.status === 403 ? 'missing_permission' : 'unknown'
      return this.cfg.i18n.targetError[key]
    },

    // Load the server/site lists for the change-target modal in one round-trip
    // (GET /connection probes both scopes). A probe failure comes back as a
    // `state`, not an HTTP error, so it maps to the same inline message.
    async loadTargetOptions() {
      this.servers = []
      this.sites = []
      this.targetError = ''
      this.busy.servers = true
      try {
        const data = await this.api('GET', '/connection')
        if (data.state && data.state !== 'ok') {
          this.targetError = this.cfg.i18n.targetError[data.state] || this.cfg.i18n.targetError.unknown
          return
        }
        this.servers = data.servers || []
        // Reuse the saved server's sites the probe already fetched; otherwise load
        // them when the saved server is present in the list.
        if (data.sites && data.sites.length && this.serverId) {
          this.sites = data.sites
        } else if (this.serverId && this.servers.some((x) => String(x.id) === String(this.serverId))) {
          await this.loadSites()
        }
      } catch (e) {
        // A decrypt-failure (409) means the token is unreadable: close the dialog
        // and let the page reconnect banner own it. Otherwise show the reason inline.
        if (e.code === 'needs_reconnect' || e.status === 409) {
          this.needsReconnect = true
          this.saved.hasToken = false
          this.targetModalOpen = false
        } else {
          this.targetError = this.targetErrorFor(e)
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

    // Connect: validate the entered token (both scopes) and persist it only if it
    // passes — the server rejects a bad or under-scoped token with a clear message,
    // so a saved token is always known-good.
    async connect() {
      const entered = this.token.trim()
      if (!entered) {
        this.setNotice('error', this.cfg.i18n.needToken)
        return
      }
      this.busy.connect = true
      this.notice = null
      try {
        const data = await this.api('POST', '/connection', { token: entered })
        this.adoptSaved(data)
        this.token = ''
        this.setNotice('success', this.cfg.i18n.connected)
      } catch (e) {
        this.handleError(e)
      } finally {
        this.busy.connect = false
      }
    },

    async disconnect() {
      this.busy.disconnect = true
      this.notice = null
      try {
        const data = await this.api('DELETE', '/connection')
        this.adoptSaved(data)
        this.token = ''
        this.serverId = ''
        this.siteId = ''
        this.servers = []
        this.sites = []
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
        // No stale options on failure; show the reason inline in the modal.
        this.sites = []
        this.targetError = this.targetErrorFor(e)
      } finally {
        this.busy.sites = false
      }
    },

    onServerChange() {
      this.siteId = ''
      this.sites = []
      this.targetError = ''
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

    openTargetModal() {
      // Start the dialog from the saved target, then lazy-load the lists it needs.
      this.serverId = this.saved.serverId
      this.siteId = this.saved.siteId
      this.targetError = ''
      this.targetModalOpen = true
      this.loadTargetOptions()
    },

    // Persist ONLY the target (its own route), so changing the flush target never
    // touches the token, events, or debounce.
    async saveTarget() {
      this.busy.target = true
      this.targetError = ''
      try {
        const data = await this.api('POST', '/target', {
          server_id: this.serverId,
          site_id: this.siteId,
          server_name: this.selectedServerName(),
          site_domain: this.selectedSiteDomain(),
        })
        this.adoptSaved(data)
        this.targetModalOpen = false
        // A decrypt-flake on save raises needsReconnect; let the page banner own it.
        if (!this.needsReconnect) this.setNotice('success', this.cfg.i18n.targetSaved)
      } catch (e) {
        this.targetError = e.message || this.cfg.i18n.genericError
      } finally {
        this.busy.target = false
      }
    },

    // Persist the event toggles + debounce window. The token (connect) and the
    // flush target (saveTarget) own their own state, so this preserves them.
    async save() {
      if (!this.debounceValid) {
        this.setNotice('error', this.cfg.i18n.badDebounce)
        return
      }
      this.busy.save = true
      this.notice = null
      try {
        await this.api('POST', '/settings', {
          server_id: this.saved.serverId,
          site_id: this.saved.siteId,
          server_name: this.saved.serverName,
          site_domain: this.saved.siteDomain,
          events: this.enabled,
          debounce: Number(this.debounce),
        })
        this.setNotice('success', this.cfg.i18n.saved)
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
