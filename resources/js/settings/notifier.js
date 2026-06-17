import Alpine from 'alpinejs'

/**
 * Settings-screen bridge to the shared toast store (components/toasts.js): transient
 * confirmations and failures are raised the same way, from anywhere on the screen.
 */
export default function createNotifier(cfg) {
  function notify(type, text, opts = {}) {
    Alpine.store('toasts').add(type, text, opts)
  }

  return {
    notify,

    // Prefer Ploi's own message when the request reached the server; fall back to one
    // shared "couldn't reach Ploi" line for network failures (which carry only a raw
    // browser error, with no status).
    notifyFailure(error) {
      notify('error', error.status ? error.message : cfg.i18n.cannotReach)
    },
  }
}
