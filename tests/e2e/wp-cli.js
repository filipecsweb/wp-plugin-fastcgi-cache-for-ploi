import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Single home for talking to the WordPress-under-test via WP-CLI.
 *
 * The auto-flush and permission specs need to perform real WP actions (publish a
 * post, switch theme, create a non-admin user, run cron). Centralising that here
 * keeps the WP-CLI dependency in one place — specs call wp()/wpAvailable() and
 * skip cleanly where it isn't usable, instead of each re-deriving paths.
 */

// Throwaway non-admin for the permissions specs (§13). Ensured by global-setup.
export const E2E_SUBSCRIBER = { login: 'e2e_subscriber', pass: 'e2e-subscriber-pass' }

/**
 * The directory holding the site's wp-cli.yml. Derived from the UNRESOLVED
 * WP_PLUGIN_PATH symlink location (its 4th parent in a Bedrock web/app/plugins
 * layout), or WP_CLI_CWD. realpath is deliberately NOT used: the plugin path is
 * a symlink to this checkout, so resolving it points at the repo, not the site.
 */
function siteRoot() {
  if (process.env.WP_CLI_CWD) return process.env.WP_CLI_CWD
  const pluginPath = process.env.WP_PLUGIN_PATH
  if (!pluginPath) return null
  const root = path.resolve(pluginPath, '..', '..', '..', '..')
  return fs.existsSync(path.join(root, 'wp-cli.yml')) ? root : null
}

let available = null

/** True if WP-CLI is installed and can bootstrap the site. Cached per process. */
export function wpAvailable() {
  if (available !== null) return available
  const root = siteRoot()
  if (!root) return (available = false)
  try {
    execFileSync('wp', ['option', 'get', 'siteurl'], { cwd: root, stdio: 'ignore' })
    available = true
  } catch {
    available = false
  }
  return available
}

/** Run a WP-CLI command against the site; returns trimmed stdout. Throws on failure. */
export function wp(args) {
  const root = siteRoot()
  if (!root) {
    throw new Error('WP-CLI working dir not resolvable — set WP_CLI_CWD or WP_PLUGIN_PATH.')
  }
  return execFileSync('wp', args, { cwd: root, encoding: 'utf8' }).trim()
}

/**
 * Best-effort WP-CLI: returns trimmed stdout, or null on any failure (stderr
 * suppressed). For calls that are expected to sometimes fail — deleting a
 * not-yet-existing transient/cron event, probing whether a user exists.
 */
export function wpTry(args) {
  const root = siteRoot()
  if (!root) return null
  try {
    return execFileSync('wp', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}
