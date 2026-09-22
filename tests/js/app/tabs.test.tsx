import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Api } from '@/shared/api'
import App from '@/app/App'
import { initialTab } from '@/app/tabs'
import { cfg, mockApi } from './fixtures'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('initialTab', () => {
  it.each([
    ['#logs', 'logs'],
    ['#settings', 'settings'],
    ['', 'settings'],
    ['#unknown', 'settings'],
  ])('opens %j as %s', (hash, tab) => {
    expect(initialTab(hash)).toBe(tab)
  })
})

describe('App tabs', () => {
  const selected = (name: string) => screen.getByRole('tab', { name }).getAttribute('aria-selected')

  it('opens the tab the URL hash names', () => {
    window.history.replaceState(null, '', '#logs')
    render(<App cfg={cfg} api={mockApi() as Api} />)

    expect(selected('Logs')).toBe('true')
    expect(selected('Settings')).toBe('false')
  })

  it('leaves the URL alone until a tab is picked', () => {
    render(<App cfg={cfg} api={mockApi() as Api} />)

    expect(selected('Settings')).toBe('true')
    expect(window.location.hash).toBe('')
  })

  it('writes the picked tab to the hash without a history entry', () => {
    render(<App cfg={cfg} api={mockApi() as Api} />)
    const entries = window.history.length

    fireEvent.click(screen.getByRole('tab', { name: 'Logs' }))

    expect(selected('Logs')).toBe('true')
    expect(window.location.hash).toBe('#logs')
    expect(window.history.length).toBe(entries)
  })
})
