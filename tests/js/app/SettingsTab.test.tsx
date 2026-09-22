import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Api } from '@/shared/api'
import App from '@/app/App'
import { cfg, mockApi } from './fixtures'

afterEach(cleanup)

const renderApp = () => {
  const api = mockApi()
  render(<App cfg={cfg} api={api as Api} />)
  return api
}

const checkbox = (name: RegExp) => screen.getByRole('checkbox', { name })
const saveButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /^(Save settings|Saving…)$/ })

describe('SettingsTab', () => {
  it('renders one labelled toggle per event, checked from the saved preferences', () => {
    renderApp()

    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(checkbox(/Post published/).getAttribute('aria-checked')).toBe('true')
    expect(checkbox(/Comment approved/).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('A comment is approved.')).toBeTruthy()
  })

  it('saves the toggled map and toasts', async () => {
    const api = renderApp()
    api.mockResolvedValueOnce({})

    fireEvent.click(checkbox(/Comment approved/))
    expect(checkbox(/Comment approved/).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(saveButton())

    expect(api).toHaveBeenCalledWith('POST', '/settings', { events: { post_save: true, comment: true } })
    expect(saveButton().disabled).toBe(true)
    expect(await screen.findByText('Settings saved.', { selector: '[data-testid="toast-success"] *' })).toBeTruthy()
    await waitFor(() => expect(saveButton().disabled).toBe(false))
  })

  it('toasts a failed save and keeps the edits', async () => {
    const api = renderApp()
    api.mockRejectedValueOnce({ code: 'rest_forbidden', message: 'Not allowed.', status: 403 })

    fireEvent.click(checkbox(/Post published/))
    fireEvent.click(saveButton())

    expect(await screen.findByText('Not allowed.', { selector: '[data-testid="toast-error"] *' })).toBeTruthy()
    expect(checkbox(/Post published/).getAttribute('aria-checked')).toBe('false')
  })

  it('renders the footer from the config', () => {
    renderApp()

    const footer = document.querySelector('footer')!
    expect(footer.textContent).toContain('FastCGI Cache for Ploi')
    expect(footer.textContent).toContain('Version 1.1.0')
    expect(footer.textContent).toContain('Ploi is a trademark of its respective owner.')
  })
})
