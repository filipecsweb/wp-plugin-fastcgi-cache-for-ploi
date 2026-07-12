/**
 * CONTRACT: consumers wire show/hide to hover+focus+click+escape (no hover on
 * touch) and give the panel `x-ref="panel"`; show(event) reads the trigger from
 * event.currentTarget.
 *
 * WHY position: fixed — the panel is placed from the trigger's viewport rect so it
 * escapes any scrolling/overflow ancestor. A hint inside the height-capped Recent
 * flushes log must not be clipped by that container nor add a horizontal scrollbar to
 * it (overflow-y:auto implies overflow-x:auto, so an in-flow panel that spilled past
 * the right edge would grow the container's scrollWidth). Because a fixed panel does
 * not track its trigger, it is dismissed on any scroll (the keyboard/click/touch open
 * paths don't self-heal like hover's mouseleave does) — except for a brief grace window
 * after opening, so the browser's focus auto-scroll that reveals a below-fold trigger
 * doesn't dismiss the tooltip it just revealed.
 *
 * @since 1.0.1 Reworked positioning: viewport-fixed panel measured and anchored to the
 *     trigger — clamped to the viewport (min edge wins when it can't be centred) and
 *     flipped above near the bottom edge — dismissed on scroll (past an open grace
 *     window so a focus reveal-scroll doesn't self-dismiss).
 * @since 1.0.0
 */
// A scroll within this window of opening is the reveal auto-scroll, not a dismiss gesture.
const DISMISS_GRACE_MS = 150

export default function tooltip() {
  // Per-instance and non-reactive: the anchor element, the scroll handler, and the
  // open timestamp are plumbing, not render state (only open/x/y drive the DOM).
  let trigger = null
  let onScroll = null
  let shownAt = 0

  return {
    open: false,
    x: 0,
    y: 0,
    show(event) {
      if (event && event.currentTarget) trigger = event.currentTarget
      this.open = true
      shownAt = performance.now()
      this.reposition() // rough placement for the first paint (panel not yet laid out)
      this.bindDismiss()
      this.$nextTick(() => this.reposition()) // refine once the panel has real dimensions
    },
    hide() {
      this.open = false
      this.unbindDismiss()
    },
    toggle(event) {
      if (this.open) this.hide()
      else this.show(event)
    },
    // Anchor the fixed panel to the trigger using the panel's measured size, so it stays
    // fully on-screen without a magic width constant (preflight is OFF → content-box).
    reposition() {
      const panel = this.$refs.panel
      if (!trigger || !panel) return
      const t = trigger.getBoundingClientRect()
      const vw = document.documentElement.clientWidth // excludes the scrollbar, unlike innerWidth
      const vh = document.documentElement.clientHeight
      const margin = 8
      const gap = 4
      const halfW = panel.offsetWidth / 2
      const center = t.left + t.width / 2
      // Centre on the trigger, clamped to the viewport; on a too-narrow viewport the
      // min (left) edge wins so the start of the text is never clipped.
      this.x = Math.round(Math.max(margin + halfW, Math.min(center, vw - margin - halfW)))
      // Below the trigger, flipped above when it would overflow the bottom edge (a fixed
      // panel can't be scrolled into view).
      const below = t.bottom + gap
      this.y = Math.round(below + panel.offsetHeight <= vh ? below : Math.max(margin, t.top - gap - panel.offsetHeight))
    },
    bindDismiss() {
      this.unbindDismiss()
      // Capture phase catches the log container's scroll too (scroll doesn't bubble),
      // not just the page's. GOTCHA: focusing a below-fold trigger auto-scrolls it into
      // view and fires this right after show(); ignore that reveal scroll so keyboard
      // users keep the tooltip — a later, deliberate scroll (past the grace) dismisses.
      onScroll = () => {
        if (performance.now() - shownAt < DISMISS_GRACE_MS) return
        this.hide()
      }
      window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    },
    unbindDismiss() {
      if (!onScroll) return
      window.removeEventListener('scroll', onScroll, { capture: true })
      onScroll = null
    },
  }
}
