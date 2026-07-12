/**
 * CONTRACT: register as an Alpine global store — Alpine.store('toasts', toastStore()).
 * Decoupled from any screen: raise a toast from anywhere with
 * $store.toasts.add(type, text, opts) (or this.$store.toasts.add inside a component).
 *
 * @since 1.0.0
 */
const DEFAULT_TIMEOUT = 10000

let nextId = 0

export default function toastStore() {
  return {
    items: [],

    add(type, text, { dismissible = true, timeout = DEFAULT_TIMEOUT } = {}) {
      // Re-raising the same message resets its countdown instead of stacking a duplicate.
      const existing = this.items.find((toast) => toast.type === type && toast.text === text)
      if (existing) {
        this.arm(existing, timeout)
        return existing.id
      }
      const id = ++nextId
      this.items.push({ id, type, text, dismissible, timeout, progress: 100, raf: null })
      this.arm(this.items[this.items.length - 1], timeout)
      return id
    },

    // (Re)start a toast's auto-dismiss countdown. progress (100→0) drives the bar;
    // GOTCHA: operate on the reactive array element, not a detached copy, or the bar
    // won't update. rAF pauses on hidden tabs, which is fine for a transient toast.
    arm(toast, timeout) {
      this.disarm(toast)
      toast.timeout = timeout
      toast.progress = 100
      if (timeout <= 0) return
      let start = null
      const tick = (now) => {
        if (start === null) start = now
        const remaining = timeout - (now - start)
        toast.progress = Math.max(0, (remaining / timeout) * 100)
        if (remaining <= 0) {
          this.remove(toast.id)
          return
        }
        toast.raf = requestAnimationFrame(tick)
      }
      toast.raf = requestAnimationFrame(tick)
    },

    disarm(toast) {
      if (toast.raf) {
        cancelAnimationFrame(toast.raf)
        toast.raf = null
      }
    },

    remove(id) {
      const toast = this.items.find((t) => t.id === id)
      if (toast) this.disarm(toast)
      this.items = this.items.filter((t) => t.id !== id)
    },
  }
}
