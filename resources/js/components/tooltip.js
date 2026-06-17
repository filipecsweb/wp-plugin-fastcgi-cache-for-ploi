// CONTRACT: tracks open/closed only; consumers must wire show/hide to
// hover+focus+click+escape (no hover on touch).
export default function tooltip() {
  return {
    open: false,
    show() {
      this.open = true
    },
    hide() {
      this.open = false
    },
    toggle() {
      this.open = !this.open
    },
  }
}
