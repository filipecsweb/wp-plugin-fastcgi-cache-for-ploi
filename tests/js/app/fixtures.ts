import { vi } from 'vitest'
import type { Api } from '@/shared/api'
import type { Config, FlushEvent, LogEntry, Settings } from '@/app/store'

export const settings: Settings = {
  hasToken: true,
  needsReconnect: false,
  serverId: 's1',
  serverName: 'web-1',
  siteId: 'w1',
  siteDomain: 'example.com',
  enabledEvents: { post_save: true, comment: false },
  isConfigured: true,
}

export const entry = (id: number, patch: Partial<LogEntry> = {}): LogEntry => ({
  id,
  created_at: '2026-09-21 21:00',
  reason: 'manual',
  reason_label: 'Manual',
  server_id: 's1',
  site_id: 'w1',
  success: true,
  http_code: 200,
  duration_ms: 12,
  message: null,
  hint: null,
  ...patch,
})

export const events: FlushEvent[] = [
  { key: 'post_save', label: 'Post published', description: 'A post or page is published or updated.', default: true },
  { key: 'comment', label: 'Comment approved', description: 'A comment is approved.', default: true },
]

export const cfg: Config = { restNamespace: 'ns', events, settings, log: [entry(1)], keyWarning: false, plugin: { name: 'FastCGI Cache for Ploi', version: '1.1.0' } }

// vi.fn<Api>() drops Api's generic, so the mock is typed on its parameters and cast back.
export const mockApi = () => vi.fn<(...args: Parameters<Api>) => Promise<unknown>>()
