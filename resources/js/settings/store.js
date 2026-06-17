/**
 * Alpine component for the FastCGI Cache for Ploi settings screen.
 *
 * Hydrated from window.PloiCacheConfig. Talks to the plugin REST routes with the
 * wp_rest nonce. Distinguishes the SAVED snapshot (what auto-flush / manual flush
 * actually use) from the editable working copy, and surfaces both Ploi API errors
 * and the decrypt-failed reconnect path (HTTP 409 / code "needs_reconnect").
 */
export default function ploiCache() {
  const cfg = window.PloiCacheConfig || {}
  const s = cfg.settings || {}

  return {
    cfg,

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

    events: cfg.events || [],
    log: cfg.log || [],
    busy: { test: false, servers: false, sites: false, save: false, flush: false, log: false, disconnect: false },
    notice: null,
    confirmingDisconnect: false,

    init() {
      // Populate the dropdowns from the saved target when we have a usable token.
      if (this.saved.hasToken && !this.needsReconnect) {
        this.loadServers()
      }
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
    get needsSetup() {
      return !this.canFlush && !this.needsReconnect
    },
    get enabledCount() {
      return Object.values(this.enabled).filter(Boolean).length
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
    async testConnection() {
      const entered = this.token.trim()
      if (!entered && !this.saved.hasToken) {
        this.setNotice('error', this.cfg.i18n.needToken)
        return
      }
      this.busy.test = true
      this.notice = null
      try {
        const data = await this.api('POST', '/connection/test', entered ? { token: entered } : {})
        this.servers = data.servers || []
        if (entered) {
          this.saved.hasToken = true
          this.needsReconnect = false
          this.token = ''
        }
        // The server cleared a now-unreadable target (the new token lacks the
        // Sites scope): adopt the fresh snapshot so Flush now disables, and warn
        // instead of silently keeping a stale, flushable target.
        if (data.settings) {
          this.adoptSaved(data.settings)
          this.serverId = ''
          this.siteId = ''
          this.sites = []
          this.setNotice('warning', data.message)
          return
        }
        if (this.serverId && this.servers.some((x) => String(x.id) === String(this.serverId))) {
          await this.loadSites()
        }
        this.setNotice('success', data.message || this.cfg.i18n.connected)
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
        if (this.serverId && this.servers.some((x) => String(x.id) === String(this.serverId))) {
          await this.loadSites()
        }
      } catch (e) {
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
        const data = await this.api('POST', '/settings', {
          token: this.token.trim() || undefined,
          server_id: this.serverId,
          site_id: this.siteId,
          server_name: this.selectedServerName(),
          site_domain: this.selectedSiteDomain(),
          events: this.enabled,
          debounce: Number(this.debounce),
        })
        this.adoptSaved(data)
        this.token = ''
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
