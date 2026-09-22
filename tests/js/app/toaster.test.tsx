import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Toaster, notify } from '@/app/toaster'

afterEach(cleanup)

// The manager outlives each render, so every test raises its own message.
describe('toaster', () => {
  it('shows a success toast as a polite dialog', () => {
    render(<Toaster />)

    act(() => notify('success', 'Settings saved.'))

    expect(screen.getByRole('dialog', { name: 'Settings saved.' })).toBeTruthy()
    expect(screen.getByTestId('toast-success').textContent).toContain('Settings saved.')
  })

  it('announces an error toast assertively', () => {
    render(<Toaster />)

    act(() => notify('error', 'Ploi said no.'))

    const toast = screen.getByTestId('toast-error')
    expect(toast.getAttribute('role')).toBe('alertdialog')
    expect(toast.textContent).toContain('Ploi said no.')
    // Base UI mirrors high-priority toasts into a live region so they are announced at once.
    expect(screen.getByRole('alert').textContent).toContain('Ploi said no.')
  })

  it('re-raising a message refreshes it instead of stacking a duplicate', () => {
    render(<Toaster />)

    act(() => notify('success', 'Flush target updated.'))
    act(() => notify('success', 'Flush target updated.'))

    expect(screen.getAllByRole('dialog', { name: 'Flush target updated.' })).toHaveLength(1)
  })

  it('dismisses from its close button', async () => {
    render(<Toaster />)
    act(() => notify('success', 'Token removed.'))
    const toast = screen.getByRole('dialog', { name: 'Token removed.' })

    fireEvent.click(toast.querySelector('button')!)

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Token removed.' })).toBeNull())
  })
})
