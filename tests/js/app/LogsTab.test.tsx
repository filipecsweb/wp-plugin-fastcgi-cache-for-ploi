import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LogsTab from '@/app/LogsTab'
import { TooltipProvider } from '@/ui/tooltip'
import { entry } from './fixtures'

afterEach(cleanup)

const renderTab = (props: Partial<Parameters<typeof LogsTab>[0]> = {}) => {
  const onRefresh = vi.fn()
  render(
    <TooltipProvider>
      <LogsTab entries={[]} busy={false} onRefresh={onRefresh} {...props} />
    </TooltipProvider>
  )
  return { onRefresh }
}

describe('LogsTab', () => {
  it('shows the empty state without a table', () => {
    renderTab()

    expect(screen.getByRole('heading', { name: 'Recent flushes' })).toBeTruthy()
    expect(screen.getByText('No flushes recorded yet.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders one row per entry, newest first as given', () => {
    renderTab({ entries: [entry(2, { created_at: 'later' }), entry(1, { created_at: 'earlier' })] })

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(rows[1].textContent).toContain('later')
    expect(rows[2].textContent).toContain('earlier')
    expect(rows[1].textContent).toContain('s1 / w1')
    expect(rows[1].textContent).toContain('12 ms')
  })

  it('marks a failed row with its status, message and hint trigger', () => {
    renderTab({
      entries: [entry(1), entry(2, { success: false, http_code: 404, message: 'Unable to find this record.', hint: 'It may have been deleted.' })],
    })
    const [, ok, failed] = within(screen.getByRole('table')).getAllByRole('row')

    expect(within(ok).getByText('Success')).toBeTruthy()
    expect(within(ok).queryByRole('button')).toBeNull()
    expect(within(failed).getByText('Failed')).toBeTruthy()
    expect(failed.textContent).toContain('HTTP 404')
    expect(failed.textContent).toContain('Unable to find this record.')
    expect(within(failed).getByRole('button', { name: 'It may have been deleted.' })).toBeTruthy()
  })

  it('hides the HTTP code when the request never reached Ploi', () => {
    renderTab({ entries: [entry(1, { success: false, http_code: 0, message: 'Offline' })] })

    expect(screen.getByRole('table').textContent).not.toContain('HTTP')
  })

  it('refreshes on demand and is disabled while busy', () => {
    const { onRefresh } = renderTab({ entries: [entry(1)] })

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)

    cleanup()
    renderTab({ busy: true })
    expect((screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the hint open when its trigger is clicked, and closes it on a later scroll', async () => {
    renderTab({ entries: [entry(1, { success: false, http_code: 404, hint: 'It may have been deleted.' })] })
    const trigger = screen.getByRole('button', { name: 'It may have been deleted.' })

    fireEvent.pointerEnter(trigger)
    fireEvent.mouseEnter(trigger)
    await screen.findByTestId('log-hint')
    fireEvent.click(trigger)
    // A scroll straight after opening is the one that revealed the trigger: the hint stays.
    act(() => void window.dispatchEvent(new Event('scroll')))
    expect(screen.queryByTestId('log-hint')).not.toBeNull()

    await act(() => new Promise((done) => setTimeout(done, 200)))
    act(() => void window.dispatchEvent(new Event('scroll')))
    await waitFor(() => expect(screen.queryByTestId('log-hint')).toBeNull())
  })
})
