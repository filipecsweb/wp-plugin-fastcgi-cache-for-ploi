/**
 * The reconnect reason codes shared by the saved-token failure path and the i18n
 * banner copy (cfg.i18n.reconnect[reason]). One JS source for the vocabulary; the
 * same codes are mirrored server-side as the wire contract.
 */
export const RECONNECT_REASON = Object.freeze({
  UNREADABLE: 'unreadable',
  INVALID: 'invalid',
  MISSING_PERMISSION: 'missing_permission',
})

// Ploi-originated error codes the REST layer forwards, distinct from WP's own
// nonce/capability guard failures.
const PLOI_ERROR = 'ploi_error'
const NEEDS_RECONNECT = 'needs_reconnect'

const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_CONFLICT = 409

/**
 * The reconnect reason an HTTP error implies (token rejected / under-scoped /
 * unreadable), or null when it's a transient failure that mustn't touch the saved
 * token. GOTCHA: gate the 401/403 cases on the Ploi error code — WP's own nonce/
 * capability guard also returns 401/403, and an expired nonce must NOT tear down a
 * healthy saved token.
 */
export function tokenFailureReason(error) {
  if (error.code === NEEDS_RECONNECT || error.status === HTTP_CONFLICT) return RECONNECT_REASON.UNREADABLE
  if (error.code === PLOI_ERROR && error.status === HTTP_UNAUTHORIZED) return RECONNECT_REASON.INVALID
  if (error.code === PLOI_ERROR && error.status === HTTP_FORBIDDEN) return RECONNECT_REASON.MISSING_PERMISSION
  return null
}

/**
 * Route a saved-token-backed failure: a token-auth failure raises the single
 * persistent reconnect banner (via requireReconnect); anything else is transient, so
 * it surfaces as a toast (via notifyFailure). NOT used by connect(), where a rejected
 * token is a fresh attempt rather than a saved-token state.
 */
export function createErrorRouter({ requireReconnect, notifyFailure }) {
  return function handleError(error) {
    const reason = tokenFailureReason(error)
    if (reason) {
      requireReconnect(reason)
      return
    }
    notifyFailure(error)
  }
}
