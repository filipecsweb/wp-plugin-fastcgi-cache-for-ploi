/**
 * Fulfil a glob-matched request with a JSON body + status, mocking the UI's own
 * fetch() calls. page.route never touches the harness's page.request, so a spec can
 * mock what the browser sees while `api` keeps reading/writing the real saved state.
 */
export const jsonRoute = (page, glob, payload, status = 200) =>
  page.route(glob, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
  )
