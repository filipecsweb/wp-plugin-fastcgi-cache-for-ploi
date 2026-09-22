import { describe, expect, it, vi } from 'vitest'
import { RECONNECT_REASON, createErrorRouter, tokenFailureReason } from '@/shared/errors'

describe('tokenFailureReason', () => {
  it.each([
    ['needs_reconnect', 409, RECONNECT_REASON.UNREADABLE],
    ['anything', 409, RECONNECT_REASON.UNREADABLE],
    ['needs_reconnect', undefined, RECONNECT_REASON.UNREADABLE],
    ['ploi_error', 401, RECONNECT_REASON.INVALID],
    ['ploi_error', 403, RECONNECT_REASON.MISSING_PERMISSION],
    // WP's own nonce/capability guard: never tears down a healthy saved token.
    ['rest_cookie_invalid_nonce', 403, null],
    ['rest_forbidden', 401, null],
    ['ploi_error', 502, null],
    ['flush_failed', 502, null],
    ['fetch_error', undefined, null],
  ])('%s / %s → %s', (code, status, reason) => {
    expect(tokenFailureReason({ code, status, message: '' })).toBe(reason)
  })
})

describe('createErrorRouter', () => {
  it('raises reconnect for a token failure and toasts anything else', () => {
    const requireReconnect = vi.fn()
    const notifyFailure = vi.fn()
    const route = createErrorRouter({ requireReconnect, notifyFailure })

    route({ code: 'ploi_error', status: 401, message: 'bad' })
    expect(requireReconnect).toHaveBeenCalledWith(RECONNECT_REASON.INVALID)
    expect(notifyFailure).not.toHaveBeenCalled()

    const transient = { code: 'fetch_error', message: 'offline' }
    route(transient)
    expect(notifyFailure).toHaveBeenCalledWith(transient)
    expect(requireReconnect).toHaveBeenCalledTimes(1)
  })
})
