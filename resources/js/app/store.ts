/**
 * Settings-screen state: one reducer, its selectors, and the async handlers that
 * talk to the plugin's REST routes.
 *
 * The SAVED snapshot (what auto-flush and Flush now actually use) is kept apart
 * from the working copies the forms edit. CONTRACT: handlers take their inputs as
 * arguments and dispatch results; they never read state after an await.
 *
 * @since 1.1.0
 */
import { useMemo, useReducer, type Dispatch } from 'react'
import { __ } from '@wordpress/i18n'
import type { Api, ApiFailure } from '@/shared/api'
import { RECONNECT_REASON, createErrorRouter, type ReconnectReason } from '@/shared/errors'

export interface Server {
  id: string
  name: string
}

export interface Site {
  id: string
  domain: string
}

/** FlushLogEntry::toArray() */
export interface LogEntry {
  id: number | null
  created_at: string
  reason: string
  reason_label: string
  server_id: string
  site_id: string
  success: boolean
  http_code: number
  duration_ms: number
  message: string | null
  hint: string | null
}

/** PloiSettings::toArray() */
export interface Settings {
  hasToken: boolean
  needsReconnect: boolean
  serverId: string
  serverName: string
  siteId: string
  siteDomain: string
  enabledEvents: Record<string, boolean>
  isConfigured: boolean
}

export interface FlushEvent {
  key: string
  label: string
  description: string
  default: boolean
}

/** The keys of window.PloiCacheConfig the React screen reads (AdminServiceProvider::config()). */
export interface Config {
  restNamespace: string
  events: FlushEvent[]
  settings: Settings
  log: LogEntry[]
  keyWarning: boolean
  plugin: { name: string; version: string }
}

interface ConnectionStatus {
  state: string
  servers?: Server[]
  sites?: Site[]
}

export interface Target {
  serverId: string
  siteId: string
}

export interface NamedTarget extends Target {
  serverName: string
  siteDomain: string
}

export interface Saved extends NamedTarget {
  hasToken: boolean
}

export const BUSY_KEYS = ['connect', 'disconnect', 'servers', 'sites', 'save', 'flush', 'log', 'target'] as const
export type BusyKey = (typeof BUSY_KEYS)[number]

export type GoneLevel = 'server' | 'site'

export interface State {
  saved: Saved
  // Why the saved token is unusable; '' when it isn't. Drives the reconnect banner's
  // copy and (through needsReconnect) whether it shows at all.
  reconnectReason: ReconnectReason | ''
  enabled: Record<string, boolean>
  target: Target
  servers: Server[]
  sites: Site[]
  // Lets the dialog tell "loaded, none found" from "load failed" (a toast).
  serversLoaded: boolean
  // A probe found the saved server/site gone from Ploi: gates canFlush until a fresh
  // valid save.
  targetStale: boolean
  targetGone: GoneLevel | ''
  targetModalOpen: boolean
  log: LogEntry[]
  busy: Record<BusyKey, boolean>
}

export type Action =
  | { type: 'busy'; key: BusyKey; value: boolean }
  | { type: 'reconnect'; reason: ReconnectReason }
  | { type: 'saved'; settings: Settings }
  | { type: 'disconnected'; settings: Settings }
  | { type: 'modal/open' }
  | { type: 'modal/close' }
  | { type: 'options/start' }
  | { type: 'options/loaded'; servers: Server[]; sites: Site[] }
  | { type: 'sites/loaded'; sites: Site[] }
  | { type: 'target/gone'; level: GoneLevel }
  | { type: 'target/server'; serverId: string }
  | { type: 'target/site'; siteId: string }
  | { type: 'event/toggle'; key: string; enabled: boolean }
  | { type: 'log/loaded'; entries: LogEntry[] }

const EMPTY_TARGET: Target = { serverId: '', siteId: '' }

// Adopt a settings snapshot as the SAVED state: connect, disconnect, save target.
const adopt = (s: Settings): Pick<State, 'saved' | 'reconnectReason' | 'targetStale'> => ({
  saved: { hasToken: s.hasToken, serverId: s.serverId, serverName: s.serverName, siteId: s.siteId, siteDomain: s.siteDomain },
  reconnectReason: s.needsReconnect ? RECONNECT_REASON.UNREADABLE : '',
  targetStale: false,
})

export function initialState(cfg: Config): State {
  return {
    ...adopt(cfg.settings),
    enabled: { ...cfg.settings.enabledEvents },
    target: EMPTY_TARGET,
    servers: [],
    sites: [],
    serversLoaded: false,
    targetGone: '',
    targetModalOpen: false,
    log: cfg.log,
    busy: Object.fromEntries(BUSY_KEYS.map((key) => [key, false])) as Record<BusyKey, boolean>,
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'busy':
      return { ...state, busy: { ...state.busy, [action.key]: action.value } }
    case 'reconnect':
      return { ...state, reconnectReason: action.reason, saved: { ...state.saved, hasToken: false }, targetModalOpen: false }
    case 'saved':
      return { ...state, ...adopt(action.settings) }
    case 'disconnected':
      return { ...state, ...adopt(action.settings), target: EMPTY_TARGET, servers: [], sites: [] }
    case 'modal/open':
      return { ...state, targetModalOpen: true, target: { serverId: state.saved.serverId, siteId: state.saved.siteId } }
    case 'modal/close':
      return { ...state, targetModalOpen: false }
    case 'options/start':
      return { ...state, servers: [], sites: [], serversLoaded: false, targetGone: '' }
    case 'options/loaded':
      return { ...state, servers: action.servers, sites: action.sites, serversLoaded: true }
    case 'sites/loaded':
      return { ...state, sites: action.sites }
    case 'target/gone':
      // A gone server takes its site and the site list with it; a gone site keeps
      // the still-valid server and its live list.
      return action.level === 'server'
        ? { ...state, targetStale: true, targetGone: 'server', target: EMPTY_TARGET, sites: [] }
        : { ...state, targetStale: true, targetGone: 'site', target: { ...state.target, siteId: '' } }
    case 'target/server':
      return { ...state, target: { serverId: action.serverId, siteId: '' }, sites: [] }
    case 'target/site':
      return { ...state, target: { ...state.target, siteId: action.siteId } }
    case 'event/toggle':
      return { ...state, enabled: { ...state.enabled, [action.key]: action.enabled } }
    case 'log/loaded':
      return { ...state, log: action.entries }
  }
}

export const needsReconnect = (s: State): boolean => s.reconnectReason !== ''

export const canFlush = (s: State): boolean =>
  s.saved.hasToken && s.saved.serverId !== '' && s.saved.siteId !== '' && !needsReconnect(s) && !s.targetStale

// '' while the reconnect banner is up: it already says why.
export const flushDisabledReason = (s: State): string =>
  needsReconnect(s) || s.saved.hasToken ? '' : __('Add a Ploi API token first.', 'fastcgi-cache-for-ploi')

/** The working copy plus its display names, as POST /target expects them. */
export const selectedTarget = (s: State): NamedTarget => ({
  serverId: s.target.serverId,
  siteId: s.target.siteId,
  serverName: s.servers.find((x) => x.id === s.target.serverId)?.name ?? s.saved.serverName,
  siteDomain: s.sites.find((x) => x.id === s.target.siteId)?.domain ?? s.saved.siteDomain,
})

export type Notify = (type: 'success' | 'error', text: string) => void

export function createActions(dispatch: Dispatch<Action>, api: Api, notify: Notify) {
  const busy = (key: BusyKey, value: boolean) => dispatch({ type: 'busy', key, value })
  const cannotReach = () => __("Couldn't reach Ploi right now. Try again in a moment.", 'fastcgi-cache-for-ploi')

  // Ploi's own message when the request reached the server; one shared line for
  // transport failures, which carry no status.
  const notifyFailure = (error: ApiFailure) =>
    notify(
      'error',
      error.status ? error.message || __('Something went wrong. Please try again.', 'fastcgi-cache-for-ploi') : cannotReach()
    )
  const route = createErrorRouter({ requireReconnect: (reason) => dispatch({ type: 'reconnect', reason }), notifyFailure })

  const loadSites = async (serverId: string): Promise<Site[]> => {
    if (!serverId) {
      dispatch({ type: 'sites/loaded', sites: [] })
      return []
    }
    busy('sites', true)
    let sites: Site[] = []
    try {
      sites = (await api<{ sites?: Site[] }>('GET', `/servers/${encodeURIComponent(serverId)}/sites`)).sites ?? []
    } catch (e) {
      route(e as ApiFailure)
    } finally {
      dispatch({ type: 'sites/loaded', sites })
      busy('sites', false)
    }
    return sites
  }

  // One round-trip: GET /connection probes both scopes and returns the servers plus
  // the saved server's sites. A failure comes back as a `state`, not an HTTP error.
  const loadTargetOptions = async (target: Target): Promise<void> => {
    dispatch({ type: 'options/start' })
    busy('servers', true)
    try {
      const data = await api<ConnectionStatus>('GET', '/connection')
      if (data.state !== 'ok') {
        if (data.state === RECONNECT_REASON.INVALID || data.state === RECONNECT_REASON.MISSING_PERMISSION) {
          dispatch({ type: 'reconnect', reason: data.state })
        } else {
          notify('error', cannotReach())
        }
        return
      }
      const servers = data.servers ?? []
      const probed = target.serverId && data.sites?.length ? data.sites : []
      dispatch({ type: 'options/loaded', servers, sites: probed })
      if (target.serverId && !servers.some((x) => x.id === target.serverId)) {
        dispatch({ type: 'target/gone', level: 'server' })
        return
      }
      const sites = probed.length || !target.serverId ? probed : await loadSites(target.serverId)
      if (target.siteId && !sites.some((x) => x.id === target.siteId)) dispatch({ type: 'target/gone', level: 'site' })
    } catch (e) {
      route(e as ApiFailure)
    } finally {
      busy('servers', false)
    }
  }

  const loadLog = async (): Promise<void> => {
    busy('log', true)
    try {
      dispatch({ type: 'log/loaded', entries: (await api<{ entries?: LogEntry[] }>('GET', '/log')).entries ?? [] })
    } catch (e) {
      route(e as ApiFailure)
    } finally {
      busy('log', false)
    }
  }

  return {
    // Resolves true when the token was saved, so the input can clear itself.
    async connect(token: string): Promise<boolean> {
      const entered = token.trim()
      if (!entered) {
        notify('error', __('Add a Ploi API token first.', 'fastcgi-cache-for-ploi'))
        return false
      }
      busy('connect', true)
      try {
        dispatch({ type: 'saved', settings: await api<Settings>('POST', '/connection', { token: entered }) })
        notify('success', __('Connected to Ploi. Now choose a flush target.', 'fastcgi-cache-for-ploi'))
        return true
      } catch (e) {
        // A rejected token here is a fresh attempt, not a saved-token state.
        notifyFailure(e as ApiFailure)
        return false
      } finally {
        busy('connect', false)
      }
    },

    async disconnect(): Promise<void> {
      busy('disconnect', true)
      try {
        dispatch({ type: 'disconnected', settings: await api<Settings>('DELETE', '/connection') })
        notify('success', __('Token removed. Add a new token to reconnect.', 'fastcgi-cache-for-ploi'))
      } catch (e) {
        notifyFailure(e as ApiFailure)
      } finally {
        busy('disconnect', false)
      }
    },

    openTargetModal(saved: Target): Promise<void> {
      dispatch({ type: 'modal/open' })
      return loadTargetOptions(saved)
    },

    closeTargetModal(): void {
      dispatch({ type: 'modal/close' })
    },

    selectServer(serverId: string): Promise<Site[]> {
      dispatch({ type: 'target/server', serverId })
      return loadSites(serverId)
    },

    selectSite(siteId: string): void {
      dispatch({ type: 'target/site', siteId })
    },

    async saveTarget({ serverId, siteId, serverName, siteDomain }: NamedTarget): Promise<void> {
      busy('target', true)
      try {
        const settings = await api<Settings>('POST', '/target', {
          server_id: serverId,
          site_id: siteId,
          server_name: serverName,
          site_domain: siteDomain,
        })
        dispatch({ type: 'saved', settings })
        dispatch({ type: 'modal/close' })
        // A decrypt flake on save raises the banner; let it own the message.
        if (!settings.needsReconnect) notify('success', __('Flush target updated.', 'fastcgi-cache-for-ploi'))
      } catch (e) {
        // The dialog stays open on a transient failure; a token failure closes it via reconnect.
        route(e as ApiFailure)
      } finally {
        busy('target', false)
      }
    },

    toggleEvent(key: string, enabled: boolean): void {
      dispatch({ type: 'event/toggle', key, enabled })
    },

    async save(enabled: Record<string, boolean>): Promise<void> {
      busy('save', true)
      try {
        await api('POST', '/settings', { events: enabled })
        notify('success', __('Settings saved.', 'fastcgi-cache-for-ploi'))
      } catch (e) {
        route(e as ApiFailure)
      } finally {
        busy('save', false)
      }
    },

    async flushNow(): Promise<void> {
      busy('flush', true)
      try {
        // CONTRACT: FlushController always returns message on success.
        notify('success', (await api<{ message: string }>('POST', '/flush', {})).message)
      } catch (e) {
        route(e as ApiFailure)
      } finally {
        // WHY: a failed flush still writes a log row server-side, so refresh regardless
        // of outcome. loadLog owns its own busy/error handling and never throws.
        await loadLog()
        busy('flush', false)
      }
    },

    loadLog,
  }
}

export type Actions = ReturnType<typeof createActions>

export function useStore(cfg: Config, api: Api, notify: Notify): { state: State; actions: Actions } {
  const [state, dispatch] = useReducer(reducer, cfg, initialState)
  const actions = useMemo(() => createActions(dispatch, api, notify), [api, notify])
  return { state, actions }
}
