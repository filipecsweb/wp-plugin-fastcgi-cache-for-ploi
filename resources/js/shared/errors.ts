/**
 * Routes a saved-token-backed failure: token-auth failures raise the persistent
 * reconnect banner, anything else is transient.
 *
 * @since 1.1.0
 */
import type { ApiFailure } from './api'

/**
 * Why the saved token is unusable. Mirrored server-side as the wire contract:
 * ConnectionController's failure states plus the decrypt failure (409).
 */
export const RECONNECT_REASON = {
  UNREADABLE: 'unreadable',
  INVALID: 'invalid',
  MISSING_PERMISSION: 'missing_permission',
} as const

export type ReconnectReason = (typeof RECONNECT_REASON)[keyof typeof RECONNECT_REASON]

// Ploi-originated error codes the REST layer forwards, distinct from WP's own
// nonce/capability guard failures.
const PLOI_ERROR = 'ploi_error'
const NEEDS_RECONNECT = 'needs_reconnect'

const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_CONFLICT = 409

/**
 * The reconnect reason an HTTP error implies, or null for a transient failure that
 * mustn't touch the saved token. GOTCHA: the 401/403 cases are gated on the Ploi
 * error code — WP's own nonce/capability guard also answers 401/403, and an expired
 * nonce must NOT tear down a healthy saved token.
 */
export function tokenFailureReason(error: ApiFailure): ReconnectReason | null {
  if (error.code === NEEDS_RECONNECT || error.status === HTTP_CONFLICT) return RECONNECT_REASON.UNREADABLE
  if (error.code === PLOI_ERROR && error.status === HTTP_UNAUTHORIZED) return RECONNECT_REASON.INVALID
  if (error.code === PLOI_ERROR && error.status === HTTP_FORBIDDEN) return RECONNECT_REASON.MISSING_PERMISSION
  return null
}

/**
 * NOT for connect(): a rejected token there is a fresh attempt, not a saved-token
 * state, so it is a toast, never the banner.
 */
export function createErrorRouter({
  requireReconnect,
  notifyFailure,
}: {
  requireReconnect: (reason: ReconnectReason) => void
  notifyFailure: (error: ApiFailure) => void
}) {
  return (error: ApiFailure): void => {
    const reason = tokenFailureReason(error)
    if (reason) requireReconnect(reason)
    else notifyFailure(error)
  }
}
