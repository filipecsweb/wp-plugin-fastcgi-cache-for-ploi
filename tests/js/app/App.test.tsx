import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Api } from '@/shared/api'
import App from '@/app/App'
import { cfg, entry, mockApi, settings } from './fixtures'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

const root = () => document.querySelector<HTMLElement>('.ploi-cache-admin')!.dataset

describe('App root contract', () => {
  it('renders the data-* attributes a configured install starts with', () => {
    render(<App cfg={{ ...cfg, log: [entry(7), entry(3)] }} api={mockApi() as Api} />)

    expect(root()).toMatchObject({ hasToken: 'true', canFlush: 'true', busyFlush: 'false', busySites: 'false', reconnectReason: '', logTopId: '7' })
  })

  it('renders the same set for an unconfigured install', () => {
    render(<App cfg={{ ...cfg, log: [], settings: { ...settings, hasToken: false, serverId: '', siteId: '' } }} api={mockApi() as Api} />)

    expect(root()).toMatchObject({ hasToken: 'false', canFlush: 'false', reconnectReason: '', logTopId: '' })
  })

  it('reloads the log from the Logs tab and toasts a failure', async () => {
    const api = mockApi()
    api.mockResolvedValueOnce({ entries: [entry(9)] })
    window.history.replaceState(null, '', '#logs')
    render(<App cfg={cfg} api={api as Api} />)
    const refresh = () => fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    refresh()
    expect(api).toHaveBeenCalledWith('GET', '/log')
    await waitFor(() => expect(root().logTopId).toBe('9'))

    api.mockRejectedValueOnce({ code: 'flush_failed', message: 'Ploi said no.', status: 502 })
    refresh()
    expect(await screen.findByText('Ploi said no.', { selector: '[data-testid="toast-error"] *' })).toBeTruthy()
  })
})
