import { test, expect } from './support/fixtures.js'
import { MOCK } from './support/config.js'
import { jsonRoute } from './support/mock.js'

/**
 * FIL-22: the Recent flushes table must be height-capped (~24rem) with an internal
 * vertical scroll and a sticky header, so a long log doesn't push the rest of the
 * page down. Before the fix the table rendered every returned row unbounded (e.g. 20
 * rows ≈ 1300px), dominating the screen.
 *
 * This drives the UI with a MOCKED GET /log so it renders far more rows than fit in
 * 24rem, deterministically and without needing a Ploi token — the assertion is purely
 * about rendering (container geometry + sticky header), not about real flush data.
 */
const MAX_H = 384 // tw:max-h-96 = 24rem at the 16px root.

const manyEntries = (n) =>
  Array.from({ length: n }, (_, i) => {
    const ok = i % 2 === 0
    return {
      id: n - i, // newest first, matching the server's id DESC ordering
      created_at: `July 12, 2026 ${String(1 + (i % 12)).padStart(2, '0')}:00 pm`,
      reason_label: 'Manual flush',
      server_id: '12345',
      site_id: '67890',
      success: ok,
      http_code: ok ? 200 : 404,
      // A non-empty hint renders the "?" trigger + its (wide) tooltip — needed to
      // exercise Defect 2.
      hint: ok ? '' : 'Ploi could not find the server or site — it may have been deleted.',
      message: ok ? '' : 'Unable to find this record.',
      duration_ms: 100 + i,
    }
  })

test.describe('Recent flushes table is height-capped and scrollable (FIL-22)', () => {
  test('with many rows the body scrolls within ~24rem and the header stays sticky', async ({ admin, settings }) => {
    await jsonRoute(admin, MOCK.log, { entries: manyEntries(30) })

    await settings.logsTab.click()
    await settings.logRefreshButton.click()
    await expect(settings.logRows).toHaveCount(30) // rows still render (regression guard)

    const m = await settings.logMetrics()
    // The content is taller than the cap, yet the container is bounded to ~24rem and
    // scrolls internally.
    expect(m.contentHeight).toBeGreaterThan(MAX_H)
    expect(m.maxHeightPx).toBe(MAX_H)
    expect(m.renderedHeight).toBeLessThanOrEqual(MAX_H + 1)
    expect(m.overflowY).toBe('auto')
    expect(m.isScrollable).toBe(true)
    // The page itself never scrolls horizontally.
    expect(m.pageScrollsHorizontally).toBe(false)

    // The header's top rule comes from ONE source (the thead's inset box-shadow); the
    // table must carry no competing border-top, else the rule doubles at rest and
    // changes when scrolled (follow-up 2).
    expect(m.tableBorderTopWidth).toBe('0px')
    expect(m.theadBoxShadowAtRest).toContain('inset')

    // The header is sticky, stays pinned to the container top while scrolling, is
    // opaque so scrolled rows can't show through it, and keeps its top rule while
    // pinned (Defect 1: a collapsed table border would scroll away).
    expect(m.theadPosition).toBe('sticky')
    const header = await settings.scrollLogAndCheckHeader()
    expect(header.scrolled).toBe(true)
    expect(header.headerPinnedToContainerTop).toBe(true)
    expect(header.theadOpaque).toBe(true)
    expect(header.theadHasStickyRule).toBe(true)
    // The top rule is pixel-stable: the box-shadow that paints it is identical at rest
    // and while scrolled (single-source consistency).
    expect(header.theadBoxShadow).toBe(m.theadBoxShadowAtRest)
  })

  test('a hint tooltip does not make the container scroll horizontally (Defect 2)', async ({ admin, settings }) => {
    await jsonRoute(admin, MOCK.log, { entries: manyEntries(30) })

    await settings.logsTab.click()
    await settings.logRefreshButton.click()
    await expect(settings.logRows).toHaveCount(30)

    // At rest the container does not overflow horizontally.
    expect((await settings.logContainerOverflow()).scrollsHorizontally).toBe(false)

    // Hovering a hint shows its (wide) tooltip; before the fix the absolutely-positioned
    // panel spilled past the container's right edge and, because overflow-y:auto implies
    // overflow-x:auto, gave the container a horizontal scrollbar. The tooltip now escapes
    // via position:fixed, so the container width is unchanged.
    const hint = settings.logHintButtons.first()
    await hint.hover()
    const tip = settings.logTooltips.first()
    await expect(tip).toBeVisible()

    // The required gate: the container width is unchanged by the open tooltip.
    const overflow = await settings.logContainerOverflow()
    expect(overflow.scrollsHorizontally).toBe(false)
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)

    // ...because the panel escapes the overflow box via position:fixed (documents the
    // mechanism that keeps the container from growing).
    await expect(tip).toHaveCSS('position', 'fixed')
  })

  test('the hint tooltip is anchored to its trigger, centred just below it (E)', async ({ admin, settings }) => {
    await jsonRoute(admin, MOCK.log, { entries: manyEntries(30) })

    await settings.logsTab.click()
    await settings.logRefreshButton.click()
    await expect(settings.logRows).toHaveCount(30)

    // A top, non-edge hint at the default 1280px viewport: no clamp, no flip — so the
    // panel should be centred on the "?" and sit 4px below it. Pins the fixed panel to
    // its trigger so a regression to stray coordinates (e.g. 0,0) fails here even though
    // the visible / position:fixed / no-h-scroll checks would still pass.
    const hint = settings.logHintButtons.first()
    await hint.hover()
    await expect(settings.logTooltips.first()).toBeVisible()

    const a = await settings.tooltipAnchor()
    expect(a).not.toBeNull()
    expect(a.centerDeltaX).toBeLessThan(2)
    expect(a.verticalGap).toBeGreaterThanOrEqual(3)
    expect(a.verticalGap).toBeLessThanOrEqual(5)
  })

  test('keyboard-focusing a below-fold hint keeps the tooltip open despite the reveal scroll (A grace window)', async ({ admin, settings }) => {
    await jsonRoute(admin, MOCK.log, { entries: manyEntries(30) })

    await settings.logsTab.click()
    await settings.logRefreshButton.click()
    await expect(settings.logRows).toHaveCount(30)

    // Focusing a "?" below the fold makes the browser auto-scroll the container to reveal
    // it; that reveal scroll must NOT dismiss the tooltip (scroll-dismiss grace window),
    // or a keyboard user never sees the hint they Tabbed to.
    const r = await settings.focusHintBelowFold()
    expect(r.found).toBe(true)
    expect(r.autoScrolled).toBe(true)

    // Settle past the grace + the async reveal-scroll event: a regressed no-grace build
    // dismisses within ~80ms, so a fixed wait here makes the assertion decisive rather
    // than catching a flicker.
    await settings.page.waitForTimeout(250)
    await expect(settings.logTooltips.first()).toBeVisible()
    // ...and it's anchored to the now-in-view trigger.
    const a = await settings.tooltipAnchor()
    expect(a.centerDeltaX).toBeLessThan(2)
  })

  test('a short log is not forced to the cap and does not scroll', async ({ admin, settings }) => {
    await jsonRoute(admin, MOCK.log, { entries: manyEntries(2) })

    await settings.logsTab.click()
    await settings.logRefreshButton.click()
    await expect(settings.logRows).toHaveCount(2)

    const m = await settings.logMetrics()
    // max-h (not a fixed height) lets a short table size to its content — no scrollbar,
    // no empty 24rem box.
    expect(m.renderedHeight).toBeLessThan(MAX_H)
    expect(m.isScrollable).toBe(false)
  })
})
