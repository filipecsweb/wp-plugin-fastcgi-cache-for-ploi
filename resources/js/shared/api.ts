/**
 * REST client for the plugin's own routes, on core's apiFetch (root URL and nonce
 * middlewares come from wp-admin). Failures are normalised to one shape so callers
 * route them (errors.ts) without re-reading the response.
 *
 * @since 1.1.0
 */
import apiFetch from '@wordpress/api-fetch'

export interface ApiFailure {
  code: string
  message: string
  // Absent when the body carried none: a transport failure, or a reply that wasn't JSON.
  status?: number
}

// apiFetch's own codes for a request that got no reply at all.
const TRANSPORT_FAILURES = ['fetch_error', 'offline_error']

export const isTransportFailure = (failure: ApiFailure): boolean => TRANSPORT_FAILURES.includes(failure.code)

export type Method = 'GET' | 'POST' | 'DELETE'

export type Api = <T>(method: Method, path: string, data?: unknown) => Promise<T>

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

// apiFetch throws the parsed WP_Error body ({ code, message, data: { status } }) or
// its own { code, message } for transport failures.
export function toApiFailure(error: unknown): ApiFailure {
  const e = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>
  const data = (typeof e.data === 'object' && e.data !== null ? e.data : {}) as Record<string, unknown>
  const failure: ApiFailure = { code: asString(e.code), message: asString(e.message) }
  if (typeof data.status === 'number') failure.status = data.status
  return failure
}

export const createApi =
  (namespace: string): Api =>
  async (method, path, data) => {
    try {
      return await apiFetch({ path: `/${namespace}${path}`, method, data })
    } catch (error) {
      throw toApiFailure(error)
    }
  }
