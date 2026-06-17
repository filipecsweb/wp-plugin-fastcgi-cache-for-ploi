/**
 * REST client for the plugin's own routes. Sends the wp_rest nonce on every request
 * and returns the parsed JSON body, or throws a normalised Error carrying the Ploi
 * error `code` and HTTP `status` so callers can route failures (see errors.js)
 * without re-reading the Response.
 */
export default function createApiClient(cfg) {
  return {
    async request(method, path, body) {
      const res = await fetch(`${cfg.restUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
        body: body ? JSON.stringify(body) : undefined,
      })

      let data = {}
      try {
        data = await res.json()
      } catch (e) {
        data = {}
      }

      if (!res.ok) {
        const err = new Error(data.message || cfg.i18n.genericError)
        err.code = data.code || ''
        err.status = res.status
        throw err
      }

      return data
    },
  }
}
