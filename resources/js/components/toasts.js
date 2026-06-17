// CONTRACT: register as an Alpine global store — Alpine.store('toasts', toastStore()).
// Decoupled from any screen: raise a toast from anywhere with
// $store.toasts.add(type, text, opts) (or this.$store.toasts.add inside a component).
let nextId = 0

export default function toastStore() {
  return {
    items: [],

    add(type, text, { dismissible = true, timeout = 5000 } = {}) {
      const id = ++nextId
      this.items.push({ id, type, text, dismissible })
      if (timeout > 0) {
        setTimeout(() => this.remove(id), timeout)
      }
      return id
    },

    remove(id) {
      this.items = this.items.filter((toast) => toast.id !== id)
    },
  }
}
