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
    // Health of the SAVED token, shown as the status dot. No probe on load: a
    // saved token reads as 'ok' until Test or the change-target modal proves
    // otherwise. Values mirror ConnectionController's states + the JS-only
    // 'checking': absent | checking | ok | invalid | missing_permission | unknown.
    connectionState: s.hasToken ? 'ok' : 'absent',

    events: cfg.events || [],
    log: cfg.log || [],
    busy: { test: false, servers: false, sites: false, save: false, flush: false, log: false, disconnect: false, target: false },
    notice: null,
    confirmingDisconnect: false,
    targetModalOpen: false,

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
      // Drop the dot to neutral only when no token remains; with a token, keep the
      // last-known health (a probe, if one follows, updates it).
      if (!data.hasToken) this.connectionState = 'absent'
    },

    // Map a Ploi probe failure to a saved-token health state (401 invalid, 403
    // missing permission, else couldn't-verify). Used wherever a live call can
    // reveal the saved token's health: the load/Save reconcile and picking a server.
    applyProbeError(e) {
      this.connectionState = e.status === 401 ? 'invalid' : e.status === 403 ? 'missing_permission' : 'unknown'
    },

    // Probe the saved token (GET /connection) and load the server/site lists in
    // one round-trip. Called when a token is saved and when the change-target
    // modal opens — never on page load, and never by Test, so testing can't move
    // the badge.
    async refreshConnection() {
      this.servers = []
      this.sites = []
      if (!this.saved.hasToken || this.needsReconnect) {
        this.connectionState = 'absent'
        return
      }
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
        // A decrypt-failure (409) routes to the reconnect banner; any other failure
        // only colours the badge — no toast on a refresh the user didn't trigger.
        if (e.code === 'needs_reconnect' || e.status === 409) {
          this.needsReconnect = true
          this.saved.hasToken = false
          this.connectionState = 'absent'
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
        // No stale options on failure; an auth/scope failure also colours the badge.
        this.sites = []
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
      this.refreshConnection()
    },

    // Persist ONLY the target (its own route), so changing the flush target never
    // touches the token, events, or debounce.
    async saveTarget() {
      this.busy.target = true
      this.notice = null
      try {
        const data = await this.api('POST', '/target', {
          server_id: this.serverId,
          site_id: this.siteId,
          server_name: this.selectedServerName(),
          site_domain: this.selectedSiteDomain(),
        })
        this.adoptSaved(data)
        this.targetModalOpen = false
        this.setNotice('success', this.cfg.i18n.targetSaved)
      } catch (e) {
        this.handleError(e)
      } finally {
        this.busy.target = false
      }
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
          server_id: this.saved.serverId,
          site_id: this.saved.siteId,
          server_name: this.saved.serverName,
          site_domain: this.saved.siteDomain,
          events: this.enabled,
          debounce: Number(this.debounce),
        })
        this.adoptSaved(data)
        this.token = ''
        // Only a freshly entered token needs a live re-check; events/debounce
        // changes don't touch the connection.
        if (submitted) {
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
