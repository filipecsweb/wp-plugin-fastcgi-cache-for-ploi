import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Api } from '@/shared/api'
import App from '@/app/App'
import type { Config, Settings } from '@/app/store'
import { cfg, mockApi, settings } from './fixtures'

afterEach(cleanup)

const disconnected: Settings = { ...settings, hasToken: false, serverId: '', serverName: '', siteId: '', siteDomain: '' }

const renderApp = (patch: Partial<Config> = {}) => {
  const api = mockApi()
  render(<App cfg={{ ...cfg, ...patch }} api={api as Api} />)
  return api
}

const tokenInput = () => document.querySelector<HTMLInputElement>('input[type="password"]')!
const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name })

describe('ConnectionCard', () => {
  it('connects on submit, then clears and locks the token field', async () => {
    const api = renderApp({ settings: disconnected })
    api.mockResolvedValueOnce(settings)

    fireEvent.change(tokenInput(), { target: { value: ' tok ' } })
    fireEvent.submit(tokenInput().form!)

    expect(api).toHaveBeenCalledWith('POST', '/connection', { token: 'tok' })
    await waitFor(() => expect(button('Disconnect')).toBeTruthy())
    expect(tokenInput().value).toBe('')
    expect(tokenInput().disabled).toBe(true)
  })

  it('keeps the entered token when Ploi rejects it', async () => {
    const api = renderApp({ settings: disconnected })
    api.mockRejectedValueOnce({ code: 'ploi_error', message: 'Token was rejected.', status: 401 })

    fireEvent.change(tokenInput(), { target: { value: 'bad' } })
    fireEvent.click(button('Connect'))

    expect(await screen.findByText('Token was rejected.', { selector: '[data-testid="toast-error"] *' })).toBeTruthy()
    expect(tokenInput().value).toBe('bad')
    expect(screen.queryByText('Reconnect required.')).toBeNull()
  })

  it('disconnects back to an empty, flush-inert card', async () => {
    const api = renderApp()
    api.mockResolvedValueOnce(disconnected)

    fireEvent.click(button('Disconnect'))

    expect(api).toHaveBeenCalledWith('DELETE', '/connection')
    await waitFor(() => expect(button('Connect')).toBeTruthy())
    expect(button('Flush now').disabled).toBe(true)
    expect(screen.getByText('Add a Ploi API token first.')).toBeTruthy()
  })

  it('names the saved target and flushes it', () => {
    const api = renderApp()
    api.mockResolvedValue({ message: 'Flushed.' })

    expect(screen.getByText('web-1 → example.com')).toBeTruthy()
    fireEvent.click(button('Flush now'))

    expect(api).toHaveBeenCalledWith('POST', '/flush', {})
  })

  it('raises the reconnect banner when Ploi rejects the saved token on flush', async () => {
    const api = renderApp()
    api.mockRejectedValueOnce({ code: 'ploi_error', message: 'Nope.', status: 403 }).mockResolvedValue({ entries: [] })

    fireEvent.click(button('Flush now'))

    expect(await screen.findByText('Reconnect required.')).toBeTruthy()
    expect(screen.getByText(/missing a required permission/)).toBeTruthy()
    expect(button('Connect')).toBeTruthy()
    expect(tokenInput().disabled).toBe(false)
  })
})

describe('Notices', () => {
  it('shows neither banner on a healthy install', () => {
    renderApp()

    expect(screen.queryByText('Reconnect required.')).toBeNull()
    expect(screen.queryByText("Harden your token's encryption key")).toBeNull()
  })

  it.each([
    ['unreadable', 'needs_reconnect', 409, /could not be read/],
    ['invalid', 'ploi_error', 401, /rejected your saved token/],
    ['missing_permission', 'ploi_error', 403, /missing a required permission/],
  ])('words the %s reconnect reason', async (_reason, code, status, copy) => {
    const api = renderApp()
    api.mockRejectedValueOnce({ code, message: '', status }).mockResolvedValue({ entries: [] })

    fireEvent.click(button('Flush now'))

    expect(await screen.findByText(copy)).toBeTruthy()
  })

  it('shows the key warning with its code samples', () => {
    renderApp({ keyWarning: true })

    expect(screen.getByText("Harden your token's encryption key")).toBeTruthy()
    expect([...document.querySelectorAll('code')].map((c) => c.textContent)).toEqual([
      'wp-config.php',
      'wp-config.php',
      "define( 'FASTCGI_CACHE_FOR_PLOI_KEY', '…' );",
      'FastCGI Cache — yoursite.com',
    ])
  })
})
