import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
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

  it('keeps every toast dismissible, however many are up', () => {
    render(<Toaster />)
    const messages = ['First up.', 'Second up.', 'Third up.', 'Fourth up.']

    act(() => messages.forEach((text) => notify('success', text)))

    for (const text of messages) expect(screen.getByRole('dialog', { name: text }).hasAttribute('inert')).toBe(false)
  })

  it('dismisses from its close button', async () => {
    render(<Toaster />)
    act(() => notify('success', 'Token removed.'))
    const toast = screen.getByRole('dialog', { name: 'Token removed.' })

    fireEvent.click(toast.querySelector('button')!)

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Token removed.' })).toBeNull())
  })

  describe('countdown', () => {
    afterEach(() => vi.useRealTimers())

    const toast = (name: string) => screen.queryByRole('dialog', { name })
    // Share of the ring still drawn, from the second circle's dash offset (100 = empty).
    const ring = (name: string) => 100 - Number(toast(name)!.querySelectorAll('circle')[1].getAttribute('stroke-dashoffset'))
    const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

    it('drains the ring and closes after 10 s, even while hovered', () => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'] })
      render(<Toaster />)
      act(() => notify('success', 'Cache flushed.'))
      fireEvent.mouseEnter(toast('Cache flushed.')!)
      fireEvent.pointerEnter(toast('Cache flushed.')!)

      advance(5_000)
      expect(ring('Cache flushed.')).toBeCloseTo(50, 0)

      advance(5_100)
      advance(1_000)
      expect(toast('Cache flushed.')).toBeNull()
    })

    it('starts over when the same message is raised again', () => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'] })
      render(<Toaster />)
      act(() => notify('success', 'Saved again.'))

      advance(6_000)
      act(() => notify('success', 'Saved again.'))
      advance(6_000)
      expect(toast('Saved again.')).not.toBeNull()
      expect(ring('Saved again.')).toBeCloseTo(40, 0)

      advance(5_000)
      advance(1_000)
      expect(toast('Saved again.')).toBeNull()
    })

    it('starts over when the message is raised again while it closes', () => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'] })
      // An exit transition that never ends: jsdom has none, so it removes a closing toast at once and a
      // re-raise would mount a new one instead of reviving the closing one, as a browser does.
      Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [{ finished: new Promise(() => {}) }] })
      onTestFinished(() => void delete (Element.prototype as Partial<Element>).getAnimations)
      render(<Toaster />)
      act(() => notify('success', 'Raised while closing.'))
      advance(10_100)
      expect(toast('Raised while closing.')!.hasAttribute('data-ending-style')).toBe(true)

      act(() => notify('success', 'Raised while closing.'))
      advance(5_000)

      expect(toast('Raised while closing.')!.hasAttribute('data-ending-style')).toBe(false)
      expect(ring('Raised while closing.')).toBeCloseTo(50, 0)
    })
  })
})
