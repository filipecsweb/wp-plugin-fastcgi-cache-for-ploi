/**
 * Reusable Alpine tooltip state.
 *
 * Content-agnostic: it only tracks open/closed. The markup that uses it supplies
 * the trigger and the bubble, and wires the events that fit the context — e.g.
 * `@mouseenter="show()"` + `@focus="show()"` to open on hover AND keyboard focus,
 * `@click="show()"` so a tap opens it on touch (where there is no hover), and
 * `@keydown.escape="hide()"` / `@click.outside="hide()"` on the wrapper to close.
 *
 * Registered as the `tooltip` Alpine component in admin.js.
 */
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
