import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApi, toApiFailure } from '@/shared/api'

// The real apiFetch runs (its default middlewares included); only the transport is stubbed.
const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const api = createApi('fastcgi-cache-for-ploi/v1')

afterEach(() => fetchMock.mockReset())

describe('createApi', () => {
  it('prefixes the namespace and sends JSON', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }))

    await expect(api('POST', '/target', { server_id: '1' })).resolves.toEqual({ ok: true })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/^\/fastcgi-cache-for-ploi\/v1\/target(\?|$)/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"server_id":"1"}')
  })

  it('normalises a WP_Error body to code, status and message', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: 'needs_reconnect', message: 'Re-enter', data: { status: 409 } }, 409))

    await expect(api('GET', '/connection')).rejects.toEqual({ code: 'needs_reconnect', status: 409, message: 'Re-enter' })
  })

  it('reports a transport failure without a status', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const failure = await api('GET', '/log').catch((e: unknown) => e)
    expect(failure).toMatchObject({ code: expect.stringMatching(/^(fetch|offline)_error$/) })
    expect(failure).not.toHaveProperty('status')
  })

  it('reports a non-JSON error body without a status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>fatal</html>', { status: 500 }))

    await expect(api('GET', '/log')).rejects.toEqual({ code: 'invalid_json', message: expect.any(String) })
  })
})

describe('toApiFailure', () => {
  it.each([
    [{ code: 'x', message: 'm', data: { status: 401 } }, { code: 'x', message: 'm', status: 401 }],
    [{ code: 'x', message: 'm', data: { status: '401' } }, { code: 'x', message: 'm' }],
    [{ message: 'm' }, { code: '', message: 'm' }],
    [new Error('boom'), { code: '', message: 'boom' }],
    ['string', { code: '', message: '' }],
    [null, { code: '', message: '' }],
  ])('%j → %j', (input, expected) => {
    expect(toApiFailure(input)).toEqual(expected)
  })
})
