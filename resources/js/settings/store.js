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
    // Why the saved token is unusable, selecting the reconnect banner's copy AND
    // (via the needsReconnect getter) whether the banner shows at all — single
    // source. Seeded from PHP only for the decrypt-failure case; runtime probes set
    // the rest.
    reconnectReason: s.needsReconnect ? 'unreadable' : '',
    keyWarning: !!cfg.keyWarning,

    events: cfg.events || [],
    log: cfg.log || [],
    busy: { connect: false, servers: false, sites: false, save: false, flush: false, log: false, disconnect: false, target: false },
    targetModalOpen: false,
    // True once a target probe has populated the server list, so the modal can tell
    // "loaded, none found" from "load failed" (the latter is surfaced via a toast).
    serversLoaded: false,

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
    // The saved token is unusable until reconnected; derived from the reason so the
    // two never drift.
    get needsReconnect() {
      return !!this.reconnectReason
    },
    get canFlush() {
      return this.saved.hasToken && !!this.saved.serverId && !!this.saved.siteId && !this.needsReconnect
    },
    get flushDisabledReason() {
      // When reconnect is required the persistent banner already says so — don't
      // duplicate it next to the Flush button.
      if (this.needsReconnect) return ''
      if (!this.saved.hasToken) return this.cfg.i18n.needToken
      if (!this.saved.serverId || !this.saved.siteId) return this.cfg.i18n.needTarget
      return ''
    },
    get debounceValid() {
      const n = Number(this.debounce)
      return Number.isInteger(n) && n >= this.cfg.debounceMin && n <= this.cfg.debounceMax
    },

    // Transient confirmation/failure that needn't persist. Delegates to the shared
    // toast store so any screen raises toasts the same way.
    toast(type, text, opts = {}) {
      this.$store.toasts.add(type, text, opts)
    },

    // The saved token can't be used until reconnected. The single entry point for
    // every such condition (decrypt-fail, invalid, missing scope): raises the
    // persistent banner with reason-specific copy and dismisses any open modal.
    requireReconnect(reason) {
      this.reconnectReason = reason
      this.saved.hasToken = false
      this.targetModalOpen = false
    },

    // The reconnect reason an HTTP error implies (token rejected/under-scoped/
    // unreadable), or null when it's a transient failure that mustn't touch the
    // saved token. GOTCHA: gate the 401/403 cases on the Ploi error code — WP's own
    // nonce/capability guard also returns 401/403, and an expired nonce must NOT
    // tear down a healthy saved token.
    tokenFailureReason(e) {
      if (e.code === 'needs_reconnect' || e.status === 409) return 'unreadable'
      if (e.code === 'ploi_error' && e.status === 401) return 'invalid'
      if (e.code === 'ploi_error' && e.status === 403) return 'missing_permission'
      return null
    },

    // Show a transient failure as a toast. Prefer Ploi's own message when the
    // request reached the server; fall back to one shared "couldn't reach Ploi"
    // line for network failures (which carry only a raw browser error).
    toastFailure(e) {
      this.toast('error', e.status ? e.message : this.cfg.i18n.cannotReach)
    },

    // A saved-token-backed action failed: a token-auth failure raises the single
    // persistent reconnect banner; anything else is transient → toast. NOT used by
    // connect(), where a rejected token is a fresh attempt, not a saved-token state.
    handleError(e) {
      const reason = this.tokenFailureReason(e)
      if (reason) {
        this.requireReconnect(reason)
        return
      }
      this.toastFailure(e)
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
      this.reconnectReason = data.needsReconnect ? 'unreadable' : ''
    },

    // Load the server/site lists for the change-target modal in one round-trip
    // (GET /connection probes both scopes). The probe reports a failure as a `state`
    // string (not an HTTP error): a bad-token state raises the reconnect banner
    // (which also closes this modal); anything else is transient.
    async loadTargetOptions() {
      this.servers = []
      this.sites = []
      this.serversLoaded = false
      this.busy.servers = true
      try {
        const data = await this.api('GET', '/connection')
        if (data.state && data.state !== 'ok') {
          if (data.state === 'invalid' || data.state === 'missing_permission') {
            this.requireReconnect(data.state)
          } else {
            this.toast('error', this.cfg.i18n.cannotReach)
          }
          return
        }
        this.servers = data.servers || []
        this.serversLoaded = true
        // Reuse the saved server's sites the probe already fetched; otherwise load
        // them when the saved server is present in the list.
        if (data.sites && data.sites.length && this.serverId) {
          this.sites = data.sites
        } else if (this.serverId && this.servers.some((x) => String(x.id) === String(this.serverId))) {
          await this.loadSites()
        }
      } catch (e) {
        this.handleError(e)
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
        this.toast('error', this.cfg.i18n.needToken)
        return
      }
      this.busy.connect = true
      try {
        const data = await this.api('POST', '/connection', { token: entered })
        this.adoptSaved(data)
        this.token = ''
        this.toast('success', this.cfg.i18n.connected)
      } catch (e) {
        // A rejected token here is a fresh attempt, not a saved-token state — toast,
        // never the reconnect banner.
        this.toastFailure(e)
      } finally {
        this.busy.connect = false
      }
    },

    async disconnect() {
      this.busy.disconnect = true
      try {
        const data = await this.api('DELETE', '/connection')
        this.adoptSaved(data)
        this.token = ''
        this.serverId = ''
        this.siteId = ''
        this.servers = []
        this.sites = []
        this.toast('success', this.cfg.i18n.disconnected)
      } catch (e) {
        this.toastFailure(e)
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
        // No stale options on failure; handleError raises the banner for a bad
        // token (401/403) or toasts a transient failure.
        this.sites = []
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

    openTargetModal() {
      // Start the dialog from the saved target, then lazy-load the lists it needs.
      this.serverId = this.saved.serverId
      this.siteId = this.saved.siteId
      this.targetModalOpen = true
      this.loadTargetOptions()
    },

    // Persist ONLY the target (its own route), so changing the flush target never
    // touches the token, events, or debounce.
    async saveTarget() {
      this.busy.target = true
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
        if (!this.needsReconnect) this.toast('success', this.cfg.i18n.targetSaved)
      } catch (e) {
        // Keep the modal open on a transient failure so the user can retry; a
        // token-unusable error (handled in handleError) closes it for the banner.
        this.handleError(e)
      } finally {
        this.busy.target = false
      }
    },

    // Persist ONLY the event toggles + debounce. The token (/connection) and the
    // flush target (/target) each own their own state and route.
    async save() {
      this.busy.save = true
      try {
        await this.api('POST', '/settings', {
          events: this.enabled,
          debounce: Number(this.debounce),
        })
        this.toast('success', this.cfg.i18n.saved)
      } catch (e) {
        this.handleError(e)
      } finally {
        this.busy.save = false
      }
    },

    async flushNow() {
      this.busy.flush = true
      try {
        const data = await this.api('POST', '/flush', {})
        // CONTRACT: FlushController always returns data.message on success, so no client fallback.
        this.toast('success', data.message)
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
  }
}
