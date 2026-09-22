import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Api } from '@/shared/api'
import App from '@/app/App'
import type { Config } from '@/app/store'
import { cfg, mockApi, settings } from './fixtures'

afterEach(cleanup)

const servers = [
  { id: 's1', name: 'web-1' },
  { id: 's2', name: 'web-2' },
]
const sites = [
  { id: 'w1', domain: 'example.com' },
  { id: 'w2', domain: 'two.com' },
]

const renderApp = (patch: Partial<Config> = {}) => {
  const api = mockApi()
  render(<App cfg={{ ...cfg, ...patch }} api={api as Api} />)
  return api
}

const dialog = () => screen.getByRole('dialog', { name: 'Change flush target' })
const pickers = () => within(dialog()).getAllByRole<HTMLSelectElement>('combobox')
const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name })
const targetButton = () => button(/^(Change|Select target)$/)

// Click the trigger and wait for the probe to hydrate the server picker.
const open = async () => {
  fireEvent.click(targetButton())
  await waitFor(() => expect(pickers()[0].disabled).toBe(false))
}
// By name: the success toast is a role="dialog" too.
const closed = () => waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change flush target' })).toBeNull())

describe('TargetDialog', () => {
  it('opens on the saved target with its sites hydrated, then saves and closes', async () => {
    const api = renderApp()
    api.mockResolvedValueOnce({ state: 'ok', servers, sites })

    await open()
    expect(api).toHaveBeenCalledWith('GET', '/connection')
    const [server, site] = pickers()
    expect(server.value).toBe('s1')
    expect(site.value).toBe('w1')

    api.mockResolvedValueOnce({ ...settings, siteId: 'w2', siteDomain: 'two.com' })
    fireEvent.change(site, { target: { value: 'w2' } })
    fireEvent.click(button('Save target'))

    expect(api).toHaveBeenCalledWith('POST', '/target', { server_id: 's1', site_id: 'w2', server_name: 'web-1', site_domain: 'two.com' })
    await closed()
    expect(screen.getByText('web-1 → two.com')).toBeTruthy()
  })

  it('gates the site picker until a server is chosen, then loads its sites', async () => {
    const api = renderApp({ settings: { ...settings, serverId: '', serverName: '', siteId: '', siteDomain: '' } })
    api.mockResolvedValueOnce({ state: 'ok', servers, sites: [] })
    expect(button('Select target')).toBeTruthy()

    await open()
    const [server, site] = pickers()
    expect(site.disabled).toBe(true)
    expect(within(dialog()).getByText('Choose a server first.')).toBeTruthy()
    expect(button('Save target').disabled).toBe(true)

    api.mockResolvedValueOnce({ sites })
    fireEvent.change(server, { target: { value: 's2' } })

    expect(api).toHaveBeenCalledWith('GET', '/servers/s2/sites')
    await waitFor(() => expect(site.disabled).toBe(false))
    fireEvent.change(site, { target: { value: 'w1' } })
    expect(button('Save target').disabled).toBe(false)
  })

  it('flags a gone server, clears both pickers and blocks Save; Cancel leaves the target unflushable', async () => {
    const api = renderApp()
    api.mockResolvedValueOnce({ state: 'ok', servers: [servers[1]], sites: [] })

    await open()
    expect(within(dialog()).getByText(/saved server no longer exists/)).toBeTruthy()
    const [server, site] = pickers()
    expect(server.value).toBe('')
    expect(site.value).toBe('')
    expect(button('Save target').disabled).toBe(true)

    fireEvent.click(button('Cancel'))
    await closed()
    expect(button('Flush now').disabled).toBe(true)
    expect(button('Select target')).toBeTruthy()
  })

  it('flags a gone site and keeps the server with its live list', async () => {
    const api = renderApp()
    api.mockResolvedValueOnce({ state: 'ok', servers, sites: [] }).mockResolvedValueOnce({ sites: [sites[1]] })

    await open()
    expect(within(dialog()).getByText(/saved site no longer exists/)).toBeTruthy()
    const [server, site] = pickers()
    expect(server.value).toBe('s1')
    expect(site.value).toBe('')
    expect([...site.options].map((o) => o.value)).toEqual(['', 'w2'])
    expect(button('Save target').disabled).toBe(true)
  })

  it('closes on Escape without a React ref warning', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const api = renderApp()
    api.mockResolvedValueOnce({ state: 'ok', servers, sites })

    await open()
    fireEvent.keyDown(dialog(), { key: 'Escape' })

    await closed()
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('closes and hides its trigger when the probe reports a token failure', async () => {
    const api = renderApp()
    api.mockResolvedValueOnce({ state: 'invalid' })

    fireEvent.click(button('Change'))

    expect(await screen.findByText('Reconnect required.')).toBeTruthy()
    await closed()
    expect(screen.queryByRole('button', { name: /^(Change|Select target)$/ })).toBeNull()
  })

  it('opens with focus on its close button', async () => {
    const api = renderApp()
    api.mockResolvedValueOnce({ state: 'ok', servers, sites })

    await open()

    await waitFor(() => expect(document.activeElement).toBe(within(dialog()).getByRole('button', { name: 'Close' })))
  })
})
