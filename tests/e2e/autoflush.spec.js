import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, wp, wpAvailable } from './fixtures.js'

// §9 / §9b — auto-flush actually firing. A WP-CLI probe (autoflush-probe.php)
// performs each content action in ONE process and reports whether a flush was
// scheduled (+ the reason, + the reason written to the log after running it).
// Synchronous → no async wp-cron race. Skips entirely without WP-CLI.

const PROBE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'support', 'autoflush-probe.php')
const probe = (action, eventKey) => JSON.parse(wp(['eval-file', PROBE, action, eventKey]))

const describeWp = wpAvailable() ? test.describe : test.describe.skip

describeWp('Auto-flush firing (§9 / §9b)', () => {
  test.describe.configure({ mode: 'serial' })

  test('publishing a post flushes, logged as post_save', () => {
    const r = probe('publish_post', 'post_save')
    expect(r.scheduled).toBe(true)
    expect(r.reason).toBe('post_save')
    expect(r.loggedReason).toBe('post_save')
  })

  test('with post_save OFF, publishing does NOT flush', () => {
    expect(probe('publish_post', 'none').scheduled).toBe(false)
  })

  test('force-deleting a published post flushes, logged as post_delete', () => {
    const r = probe('delete_post', 'post_delete')
    expect(r.scheduled).toBe(true)
    expect(r.reason).toBe('post_delete')
    expect(r.loggedReason).toBe('post_delete')
  })

  // §9b — the single "comment" toggle gates three underlying hooks. Prove each one
  // flushes when ON and that none flush when OFF (no hook bypasses the gate).
  for (const hook of ['comment_post', 'comment_transition', 'comment_edit']) {
    test(`§9b ${hook}: toggle ON → flush, logged as comment`, () => {
      const r = probe(hook, 'comment')
      expect(r.scheduled).toBe(true)
      expect(r.reason).toBe('comment')
      expect(r.loggedReason).toBe('comment')
    })

    test(`§9b ${hook}: toggle OFF → no flush`, () => {
      expect(probe(hook, 'none').scheduled).toBe(false)
    })
  }
})
