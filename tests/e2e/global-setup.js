import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { E2E_SUBSCRIBER, wp, wpAvailable, wpTry } from './wp-cli.js'

/**
 * E2E preflight: the WordPress under test must serve THIS checkout.
 *
 * Otherwise the suite silently validates a stale or duplicate copy of the plugin
 * (a real debugging trap — two .test sites each had their own copy). When
 * WP_PLUGIN_PATH is set, assert it resolves to this repo and fail loudly if not.
 * When it is unset (e.g. a local site whose plugin dir is a plain copy rather than
 * a symlink to this checkout), skip with a notice rather than block.
 */
export default function globalSetup() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  const target = process.env.WP_BASE_URL || '(WP_BASE_URL unset)'
  const pluginPath = process.env.WP_PLUGIN_PATH

  if (!pluginPath) {
    console.warn(
      `[e2e] WP_PLUGIN_PATH unset — skipping the "served plugin == this checkout" check. Target: ${target}`
    )
    return
  }

  let resolved
  try {
    resolved = fs.realpathSync(pluginPath)
  } catch {
    throw new Error(
      `[e2e] WP_PLUGIN_PATH does not exist: ${pluginPath}\n` +
        `The WordPress under test (${target}) must serve this plugin. ` +
        `Fix the path or the symlink before running e2e.`
    )
  }

  const repoReal = fs.realpathSync(repoRoot)
  if (resolved !== repoReal) {
    throw new Error(
      `[e2e] The plugin served by ${target} is NOT this checkout — e2e would test stale code.\n` +
        `  WP_PLUGIN_PATH resolves to: ${resolved}\n` +
        `  this checkout is:           ${repoReal}\n` +
        `Symlink the plugin to this repo (or update WP_PLUGIN_PATH) before running e2e.`
    )
  }

  console.log(`[e2e] OK — ${target} serves this checkout (${repoReal}).`)

  // Normalise the WP-under-test to a deterministic baseline via WP-CLI: clear any
  // saved connection / pending flush (kills the "stale saved token" flake), and
  // ensure the throwaway non-admin the permission specs log in as. Best-effort —
  // when WP-CLI isn't usable, the browser-only specs still run; the WP-CLI-backed
  // ones (auto-flush, non-admin) skip themselves.
  if (!wpAvailable()) {
    console.warn('[e2e] WP-CLI not available — skipping baseline reset + subscriber setup.')
    return
  }

  wpTry(['option', 'delete', 'ploi_fastcgi_cache_settings'])
  wpTry(['transient', 'delete', 'ploi_fastcgi_cache_pending'])
  wpTry(['cron', 'event', 'delete', 'ploi_fastcgi_cache_flush'])

  if (wpTry(['user', 'get', E2E_SUBSCRIBER.login, '--field=ID'])) {
    wp(['user', 'update', E2E_SUBSCRIBER.login, '--role=subscriber', `--user_pass=${E2E_SUBSCRIBER.pass}`])
  } else {
    wp([
      'user', 'create', E2E_SUBSCRIBER.login, `${E2E_SUBSCRIBER.login}@example.test`,
      '--role=subscriber', `--user_pass=${E2E_SUBSCRIBER.pass}`,
    ])
  }
  console.log('[e2e] baseline reset + subscriber ensured (WP-CLI).')
}
