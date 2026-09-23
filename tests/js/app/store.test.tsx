import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Api, ApiFailure } from '@/shared/api'
import { RECONNECT_REASON } from '@/shared/errors'
import {
  canFlush,
  createActions,
  flushDisabledReason,
  initialState,
  needsReconnect,
  reducer,
  selectedTarget,
  useStore,
  type Action,
  type Settings,
  type State,
} from '@/app/store'
import { cfg, entry, mockApi, settings } from './fixtures'

const servers = [
  { id: 's1', name: 'web-1' },
  { id: 's2', name: 'web-2' },
]
const sites = [{ id: 'w1', domain: 'example.com' }]

const failure = (code: string, status?: number): ApiFailure => ({ code, message: `${code} message`, status })
const PLOI_401 = failure('ploi_error', 401)
const UPSTREAM_502 = failure('flush_failed', 502)
const OFFLINE = failure('fetch_error')

const withSaved = (patch: Partial<Settings>) => reducer(initialState(cfg), { type: 'saved', settings: { ...settings, ...patch } })

describe('initialState', () => {
  it('seeds the saved snapshot, the working copies and the log from the config', () => {
    const s = initialState(cfg)

    expect(s.saved).toEqual({ hasToken: true, serverId: 's1', serverName: 'web-1', siteId: 'w1', siteDomain: 'example.com' })
    expect(s.reconnectReason).toBe('')
    expect(s.enabled).toEqual(settings.enabledEvents)
    expect(s.enabled).not.toBe(settings.enabledEvents)
    expect(s.target).toEqual({ serverId: '', siteId: '' })
    expect(s.log).toEqual([entry(1)])
    expect(Object.values(s.busy)).toEqual(Array(8).fill(false))
  })

  it('reads the decrypt failure PHP reports as the unreadable reason', () => {
    expect(initialState({ ...cfg, settings: { ...settings, hasToken: false, needsReconnect: true } }).reconnectReason).toBe(
      RECONNECT_REASON.UNREADABLE
    )
  })
})

describe('reducer', () => {
  const open = reducer(initialState(cfg), { type: 'modal/open' })
  const loaded = reducer(open, { type: 'options/loaded', servers, sites })

  it.each<[string, State, Action, Partial<State>]>([
    ['busy on', initialState(cfg), { type: 'busy', key: 'flush', value: true }, { busy: { ...initialState(cfg).busy, flush: true } }],
    [
      'reconnect drops the token and closes the dialog',
      loaded,
      { type: 'reconnect', reason: RECONNECT_REASON.INVALID },
      { reconnectReason: RECONNECT_REASON.INVALID, saved: { ...loaded.saved, hasToken: false }, targetModalOpen: false },
    ],
    [
      'saved adopts the snapshot and clears a stale target',
      reducer(loaded, { type: 'target/gone', level: 'site' }),
      { type: 'saved', settings: { ...settings, siteId: 'w2', siteDomain: 'two.com' } },
      { saved: { ...loaded.saved, siteId: 'w2', siteDomain: 'two.com' }, targetStale: false },
    ],
    [
      'saved with needsReconnect raises the unreadable reason',
      loaded,
      { type: 'saved', settings: { ...settings, hasToken: false, needsReconnect: true } },
      { reconnectReason: RECONNECT_REASON.UNREADABLE, saved: { ...loaded.saved, hasToken: false } },
    ],
    [
      'disconnected also resets the working copy and the lists',
      loaded,
      { type: 'disconnected', settings: { ...settings, hasToken: false, serverId: '', serverName: '', siteId: '', siteDomain: '' } },
      {
        saved: { hasToken: false, serverId: '', serverName: '', siteId: '', siteDomain: '' },
        target: { serverId: '', siteId: '' },
        servers: [],
        sites: [],
      },
    ],
    ['modal/open starts from the saved target', initialState(cfg), { type: 'modal/open' }, { targetModalOpen: true, target: { serverId: 's1', siteId: 'w1' } }],
    ['modal/close', open, { type: 'modal/close' }, { targetModalOpen: false }],
    [
      'options/start clears the lists and the gone notice',
      reducer(loaded, { type: 'target/gone', level: 'site' }),
      { type: 'options/start' },
      { servers: [], sites: [], serversLoaded: false, targetGone: '', targetStale: true },
    ],
    ['options/loaded', open, { type: 'options/loaded', servers, sites }, { servers, sites, serversLoaded: true }],
    ['sites/loaded', open, { type: 'sites/loaded', serverId: 's1', sites }, { sites }],
    [
      'a gone server takes its site and the site list with it',
      loaded,
      { type: 'target/gone', level: 'server' },
      { targetStale: true, targetGone: 'server', target: { serverId: '', siteId: '' }, sites: [], servers },
    ],
    [
      'a gone site keeps the server and its list',
      loaded,
      { type: 'target/gone', level: 'site' },
      { targetStale: true, targetGone: 'site', target: { serverId: 's1', siteId: '' }, sites },
    ],
    ['picking a server resets the site and its list', loaded, { type: 'target/server', serverId: 's2' }, { target: { serverId: 's2', siteId: '' }, sites: [] }],
    ['picking a site', loaded, { type: 'target/site', siteId: 'w9' }, { target: { serverId: 's1', siteId: 'w9' } }],
    ['event/toggle edits the working copy only', initialState(cfg), { type: 'event/toggle', key: 'comment', enabled: true }, { enabled: { post_save: true, comment: true } }],
    ['log/loaded', initialState(cfg), { type: 'log/loaded', entries: [entry(2), entry(1)] }, { log: [entry(2), entry(1)] }],
  ])('%s', (_, before, action, expected) => {
    const after = reducer(before, action)

    expect(after).toEqual({ ...before, ...expected })
    expect(after).not.toBe(before)
  })
})

describe('selectors', () => {
  it.each<[string, State, boolean]>([
    ['configured', initialState(cfg), true],
    ['no token', withSaved({ hasToken: false }), false],
    ['no server', withSaved({ serverId: '' }), false],
    ['no site', withSaved({ siteId: '' }), false],
    ['reconnect required', reducer(initialState(cfg), { type: 'reconnect', reason: RECONNECT_REASON.INVALID }), false],
    ['target gone', reducer(initialState(cfg), { type: 'target/gone', level: 'site' }), false],
  ])('canFlush: %s', (_, state, expected) => {
    expect(canFlush(state)).toBe(expected)
  })

  it('flushDisabledReason asks for a token, but stays quiet under the reconnect banner', () => {
    expect(flushDisabledReason(initialState(cfg))).toBe('')
    expect(flushDisabledReason(withSaved({ hasToken: false }))).toBe('Add a Ploi API token first.')
    const reconnect = reducer(withSaved({ hasToken: false }), { type: 'reconnect', reason: RECONNECT_REASON.UNREADABLE })
    expect(needsReconnect(reconnect)).toBe(true)
    expect(flushDisabledReason(reconnect)).toBe('')
  })

  it('selectedTarget names the picked server/site, falling back to the saved names', () => {
    const open = reducer(initialState(cfg), { type: 'modal/open' })
    expect(selectedTarget(open)).toEqual({ serverId: 's1', siteId: 'w1', serverName: 'web-1', siteDomain: 'example.com' })

    const picked = reducer(reducer(open, { type: 'options/loaded', servers, sites }), { type: 'target/server', serverId: 's2' })
    expect(selectedTarget(picked)).toEqual({ serverId: 's2', siteId: '', serverName: 'web-2', siteDomain: 'example.com' })
  })
})

describe('actions', () => {
  const api = mockApi()
  const dispatch = vi.fn<(action: Action) => void>()
  const notify = vi.fn()
  const actions = createActions(dispatch, api as Api, notify)
  // Everything the handler dispatched, applied in order: proves handler + reducer together.
  const applied = (from: State = initialState(cfg)) => dispatch.mock.calls.reduce((s, [action]) => reducer(s, action), from)
  const busyTrail = (key: string) => dispatch.mock.calls.filter(([a]) => a.type === 'busy' && a.key === key).map(([a]) => a.type === 'busy' && a.value)

  beforeEach(() => {
    api.mockReset()
    dispatch.mockReset()
    notify.mockReset()
  })

  describe('connect', () => {
    it('refuses an empty token without a request', async () => {
      await expect(actions.connect('   ')).resolves.toBe(false)

      expect(api).not.toHaveBeenCalled()
      expect(notify).toHaveBeenCalledWith('error', 'Add a Ploi API token first.')
    })

    it('adopts the saved snapshot on success', async () => {
      api.mockResolvedValueOnce({ ...settings, serverId: '', siteId: '' })

      await expect(actions.connect(' tok ')).resolves.toBe(true)

      expect(api).toHaveBeenCalledWith('POST', '/connection', { token: 'tok' })
      expect(applied(withSaved({ hasToken: false })).saved).toMatchObject({ hasToken: true, serverId: '' })
      expect(busyTrail('connect')).toEqual([true, false])
      expect(notify).toHaveBeenCalledWith('success', 'Connected to Ploi. Now choose a flush target.')
    })

    it('toasts a rejected token instead of raising the banner', async () => {
      api.mockRejectedValueOnce(PLOI_401)

      await expect(actions.connect('tok')).resolves.toBe(false)

      expect(notify).toHaveBeenCalledWith('error', 'ploi_error message')
      expect(applied().reconnectReason).toBe('')
      expect(busyTrail('connect')).toEqual([true, false])
    })
  })

  describe('disconnect', () => {
    it('adopts the blank snapshot and resets the working copy', async () => {
      api.mockResolvedValueOnce({ ...settings, hasToken: false, serverId: '', serverName: '', siteId: '', siteDomain: '' })

      await actions.disconnect()

      expect(api).toHaveBeenCalledWith('DELETE', '/connection')
      const s = applied(reducer(initialState(cfg), { type: 'options/loaded', servers, sites }))
      expect(s.saved.hasToken).toBe(false)
      expect(s.servers).toEqual([])
      expect(notify).toHaveBeenCalledWith('success', 'Token removed. Add a new token to reconnect.')
      expect(busyTrail('disconnect')).toEqual([true, false])
    })

    it('toasts a failure', async () => {
      api.mockRejectedValueOnce(OFFLINE)

      await actions.disconnect()

      expect(notify).toHaveBeenCalledWith('error', "Couldn't reach Ploi right now. Try again in a moment.")
      expect(applied().saved.hasToken).toBe(true)
    })
  })

  describe('openTargetModal', () => {
    const saved = { serverId: 's1', siteId: 'w1' }

    it('opens, then reuses the sites the probe returned for the saved server', async () => {
      api.mockResolvedValueOnce({ state: 'ok', servers, sites })

      await actions.openTargetModal(saved)

      expect(api).toHaveBeenCalledTimes(1)
      const s = applied()
      expect(s).toMatchObject({ targetModalOpen: true, target: saved, servers, sites, serversLoaded: true, targetGone: '', targetStale: false })
      expect(busyTrail('servers')).toEqual([true, false])
    })

    it('loads the sites itself when the probe returned none', async () => {
      api.mockResolvedValueOnce({ state: 'ok', servers, sites: [] }).mockResolvedValueOnce({ sites })

      await actions.openTargetModal(saved)

      expect(api).toHaveBeenLastCalledWith('GET', '/servers/s1/sites')
      expect(applied()).toMatchObject({ sites, targetGone: '', targetStale: false })
      expect(busyTrail('sites')).toEqual([true, false])
    })

    it('skips the sites load when nothing is saved', async () => {
      api.mockResolvedValueOnce({ state: 'ok', servers, sites: [] })

      await actions.openTargetModal({ serverId: '', siteId: '' })

      expect(api).toHaveBeenCalledTimes(1)
      expect(applied()).toMatchObject({ servers, sites: [], serversLoaded: true, targetStale: false })
    })

    it('marks a saved server gone from Ploi and keeps the list', async () => {
      api.mockResolvedValueOnce({ state: 'ok', servers: [servers[1]], sites: [] })

      await actions.openTargetModal(saved)

      expect(api).toHaveBeenCalledTimes(1)
      expect(applied()).toMatchObject({ targetGone: 'server', targetStale: true, target: { serverId: '', siteId: '' }, servers: [servers[1]], sites: [] })
    })

    it('marks a saved site gone from Ploi and keeps its server', async () => {
      api.mockResolvedValueOnce({ state: 'ok', servers, sites: [{ id: 'w2', domain: 'other.com' }] })

      await actions.openTargetModal(saved)

      expect(applied()).toMatchObject({ targetGone: 'site', targetStale: true, target: { serverId: 's1', siteId: '' }, sites: [{ id: 'w2', domain: 'other.com' }] })
    })

    it.each([RECONNECT_REASON.INVALID, RECONNECT_REASON.MISSING_PERMISSION])('raises the banner and closes on state %s', async (state) => {
      api.mockResolvedValueOnce({ state, servers: [], sites: [] })

      await actions.openTargetModal(saved)

      expect(applied()).toMatchObject({ reconnectReason: state, targetModalOpen: false, saved: { hasToken: false } })
      expect(notify).not.toHaveBeenCalled()
      expect(busyTrail('servers')).toEqual([true, false])
    })

    it('toasts the unknown state without touching the token', async () => {
      api.mockResolvedValueOnce({ state: 'unknown', servers: [], sites: [] })

      await actions.openTargetModal(saved)

      expect(notify).toHaveBeenCalledWith('error', "Couldn't reach Ploi right now. Try again in a moment.")
      expect(applied()).toMatchObject({ reconnectReason: '', targetModalOpen: true, serversLoaded: false })
    })

    it('routes an HTTP failure of the probe', async () => {
      api.mockRejectedValueOnce(failure('needs_reconnect', 409))

      await actions.openTargetModal(saved)

      expect(applied()).toMatchObject({ reconnectReason: RECONNECT_REASON.UNREADABLE, targetModalOpen: false })
      expect(busyTrail('servers')).toEqual([true, false])
    })
  })

  describe('selectServer', () => {
    it('resets the site, loads the new list', async () => {
      api.mockResolvedValueOnce({ sites })

      await expect(actions.selectServer('s2')).resolves.toEqual(sites)

      expect(api).toHaveBeenCalledWith('GET', '/servers/s2/sites')
      expect(applied()).toMatchObject({ target: { serverId: 's2', siteId: '' }, sites })
      expect(busyTrail('sites')).toEqual([true, false])
    })

    it('clears the list without a request when no server is picked', async () => {
      await expect(actions.selectServer('')).resolves.toEqual([])

      expect(api).not.toHaveBeenCalled()
      expect(applied(reducer(initialState(cfg), { type: 'options/loaded', servers, sites })).sites).toEqual([])
    })

    it('leaves no stale options on a failure and routes it', async () => {
      api.mockRejectedValueOnce(UPSTREAM_502)

      await expect(actions.selectServer('s2')).resolves.toEqual([])

      expect(applied(reducer(initialState(cfg), { type: 'options/loaded', servers, sites })).sites).toEqual([])
      expect(notify).toHaveBeenCalledWith('error', 'flush_failed message')
      expect(busyTrail('sites')).toEqual([true, false])
    })

    it('keeps the last picked server’s list when an earlier reply lands after it', async () => {
      let replyForS1: (reply: { sites: typeof sites }) => void = () => {}
      api.mockReturnValueOnce(new Promise((resolve) => (replyForS1 = resolve)))
      api.mockResolvedValueOnce({ sites })

      const first = actions.selectServer('s1')
      await actions.selectServer('s2')
      replyForS1({ sites: [{ id: 'w9', domain: 'other.com' }] })
      await first

      expect(applied()).toMatchObject({ target: { serverId: 's2', siteId: '' }, sites })
    })

    it('escapes the server id in the path', async () => {
      api.mockResolvedValueOnce({ sites: [] })

      await actions.selectServer('a/b')

      expect(api).toHaveBeenCalledWith('GET', '/servers/a%2Fb/sites')
    })
  })

  it('selectSite and closeTargetModal only dispatch', () => {
    actions.selectSite('w2')
    actions.closeTargetModal()

    expect(dispatch.mock.calls.map(([a]) => a)).toEqual([{ type: 'target/site', siteId: 'w2' }, { type: 'modal/close' }])
  })

  describe('saveTarget', () => {
    const target = { serverId: 's2', siteId: 'w2', serverName: 'web-2', siteDomain: 'two.com' }

    it('posts the snake_case body, adopts the snapshot and closes the dialog', async () => {
      api.mockResolvedValueOnce({ ...settings, ...target })

      await actions.saveTarget(target)

      expect(api).toHaveBeenCalledWith('POST', '/target', { server_id: 's2', site_id: 'w2', server_name: 'web-2', site_domain: 'two.com' })
      const s = applied(reducer(initialState(cfg), { type: 'modal/open' }))
      expect(s).toMatchObject({ targetModalOpen: false, saved: { ...target, hasToken: true }, targetStale: false })
      expect(notify).toHaveBeenCalledWith('success', 'Flush target updated.')
      expect(busyTrail('target')).toEqual([true, false])
    })

    it('lets the banner own a decrypt flake on save', async () => {
      api.mockResolvedValueOnce({ ...settings, ...target, hasToken: false, needsReconnect: true })

      await actions.saveTarget(target)

      expect(notify).not.toHaveBeenCalled()
      expect(applied()).toMatchObject({ reconnectReason: RECONNECT_REASON.UNREADABLE, targetModalOpen: false })
    })

    it('keeps the dialog open on a transient failure', async () => {
      api.mockRejectedValueOnce(UPSTREAM_502)

      await actions.saveTarget(target)

      expect(applied(reducer(initialState(cfg), { type: 'modal/open' }))).toMatchObject({ targetModalOpen: true, saved: initialState(cfg).saved })
      expect(notify).toHaveBeenCalledWith('error', 'flush_failed message')
    })

    it('closes the dialog through the banner on a token failure', async () => {
      api.mockRejectedValueOnce(failure('ploi_error', 403))

      await actions.saveTarget(target)

      expect(applied(reducer(initialState(cfg), { type: 'modal/open' }))).toMatchObject({
        targetModalOpen: false,
        reconnectReason: RECONNECT_REASON.MISSING_PERMISSION,
      })
      expect(notify).not.toHaveBeenCalled()
    })
  })

  describe('save', () => {
    it('posts the working copy of the events', async () => {
      api.mockResolvedValueOnce(settings)
      actions.toggleEvent('comment', true)

      await actions.save({ post_save: true, comment: true })

      expect(api).toHaveBeenCalledWith('POST', '/settings', { events: { post_save: true, comment: true } })
      expect(applied().enabled).toEqual({ post_save: true, comment: true })
      expect(notify).toHaveBeenCalledWith('success', 'Settings saved.')
      expect(busyTrail('save')).toEqual([true, false])
    })

    it('routes a failure', async () => {
      api.mockRejectedValueOnce(PLOI_401)

      await actions.save({})

      expect(applied()).toMatchObject({ reconnectReason: RECONNECT_REASON.INVALID })
      expect(busyTrail('save')).toEqual([true, false])
    })
  })

  describe('flushNow', () => {
    it('toasts the server message and reloads the log', async () => {
      api.mockResolvedValueOnce({ success: true, message: 'FastCGI cache flushed.' }).mockResolvedValueOnce({ entries: [entry(2), entry(1)] })

      await actions.flushNow()

      expect(api.mock.calls).toEqual([
        ['POST', '/flush', {}],
        ['GET', '/log'],
      ])
      expect(applied().log).toEqual([entry(2), entry(1)])
      expect(notify).toHaveBeenCalledWith('success', 'FastCGI cache flushed.')
      // The log reload completes inside the flush's busy window.
      expect(dispatch.mock.calls.map(([a]) => a.type === 'busy' && `${a.key}:${a.value}`).filter(Boolean)).toEqual([
        'flush:true',
        'log:true',
        'log:false',
        'flush:false',
      ])
    })

    it('still reloads the log after a failed flush', async () => {
      api.mockRejectedValueOnce(UPSTREAM_502).mockResolvedValueOnce({ entries: [entry(3)] })

      await actions.flushNow()

      expect(api).toHaveBeenLastCalledWith('GET', '/log')
      expect(applied().log).toEqual([entry(3)])
      expect(notify).toHaveBeenCalledWith('error', 'flush_failed message')
      expect(busyTrail('flush')).toEqual([true, false])
    })

    it('raises the banner when Ploi rejects the saved token', async () => {
      api.mockRejectedValueOnce(PLOI_401).mockResolvedValueOnce({ entries: [] })

      await actions.flushNow()

      expect(applied()).toMatchObject({ reconnectReason: RECONNECT_REASON.INVALID, log: [] })
      expect(notify).not.toHaveBeenCalled()
    })

    it('never throws when the log reload fails too', async () => {
      api.mockRejectedValueOnce(UPSTREAM_502).mockRejectedValueOnce(OFFLINE)

      await expect(actions.flushNow()).resolves.toBeUndefined()

      expect(applied().log).toEqual([entry(1)])
      expect(busyTrail('flush')).toEqual([true, false])
      expect(busyTrail('log')).toEqual([true, false])
    })
  })

  it('loadLog replaces the entries', async () => {
    api.mockResolvedValueOnce({ entries: [entry(5)] })

    await actions.loadLog()

    expect(api).toHaveBeenCalledWith('GET', '/log')
    expect(applied().log).toEqual([entry(5)])
    expect(busyTrail('log')).toEqual([true, false])
  })

  it('falls back to a generic line when the server answered without a message', async () => {
    api.mockRejectedValueOnce({ code: 'x', status: 500, message: '' })

    await actions.disconnect()

    expect(notify).toHaveBeenCalledWith('error', 'Something went wrong. Please try again.')
  })
})

describe('useStore', () => {
  it('wires the reducer to the handlers', async () => {
    const api = mockApi().mockResolvedValueOnce({ entries: [entry(9)] })
    const notify = vi.fn()
    const { result } = renderHook(() => useStore(cfg, api as Api, notify))

    expect(result.current.state.log).toEqual([entry(1)])
    expect(canFlush(result.current.state)).toBe(true)

    await act(() => result.current.actions.loadLog())

    expect(result.current.state.log).toEqual([entry(9)])
    expect(result.current.state.busy.log).toBe(false)
  })
})
