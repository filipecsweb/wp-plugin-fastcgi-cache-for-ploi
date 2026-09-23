/**
 * Fulfil a matched request with a JSON body + status, mocking the UI's own
 * fetch() calls. page.route never touches the harness's page.request, so a spec can
 * mock what the browser sees while `api` keeps reading/writing the real saved state.
 */
export const jsonRoute = (page, match, payload, status = 200) =>
  page.route(match, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
  )

/**
 * Fulfil with a WP_Error as WordPress's REST server sends it: the status travels in
 * the body's `data` too, which is where core's apiFetch reads it from.
 */
export const wpErrorRoute = (page, match, code, message, status) =>
  jsonRoute(page, match, { code, message, data: { status } }, status)
