# CLAUDE.md — FastCGI Cache for Ploi

This plugin is built on the **WPForge** base: a reusable kernel in `foundation/`
(namespace `WPForge\`), opt-in features in `modules/`, and this plugin's own code in
`src/` (namespace `FastCgiCacheForPloi\`). Read this before changing anything. When a rule here
conflicts with a habit or a quick shortcut, the rule wins.

## Code principles
- **One source of truth.** Every value, rule, or list lives in exactly one place. Need it
  twice? Reference the single definition — never copy. Shared lists (hook/event definitions,
  defaults) have one canonical home; read from it, don't restate it.
- **No duplication.** Before adding code, check whether it already exists — in this plugin
  AND in `foundation/`. If it does, reuse it. If two things are almost-the-same, extract the
  shared part and parameterize the difference.
- **Reuse the kernel, don't reroll it.** The foundation already provides: DI container,
  attribute hooks, typed Options/Settings, dbDelta migrations, an HTTP wrapper (no Guzzle),
  nonce/capability/sanitize/escape + sodium crypto, a PSR-3 logger, a REST base controller,
  the vendored Vite enqueuer, and i18n. Use these — never hand-roll a second HTTP client,
  logger, or settings layer.
- **Coherent & consistent.** Match existing patterns, names, and structure. Don't invent a
  second way to do something the codebase already does.
- **When you catch yourself duplicating, stop and refactor** to a shared abstraction.
- **No placeholders.** No TODOs, stubs, "implement later," or magic numbers — name and
  centralize constants.

## Comments
Comments explain what the code CAN'T say. Default to none. Assume a senior reader who can
read the code in 10 seconds. Write one ONLY for:
- **WHY:** rationale for a non-obvious choice.
- **GOTCHA:** side effects or ordering constraints ("don't reorder these").
- **CONTRACT:** assumptions the code can't enforce ("caller must hold the lock", "expects
  sorted input").
- **LINK:** ticket/spec URL, or a browser-bug workaround reference.

NEVER write a comment that restates the code or a well-named symbol, describes where
something is rendered/placed, would become false if the code were moved or reused, or labels
obvious structure. Test: if moving the code would make the comment wrong, it's describing
context, not code — don't write it.

## Architecture invariants (do not violate)
- **`foundation/` is a pure kernel.** It ships only generic primitives + the module contract.
  NEVER put plugin-specific code (this plugin's API client, custom tables, domain hooks) in
  `foundation/`. Plugin code → `src/`. Reusable opt-in features → `modules/`. Test: copying
  `foundation/` alone yields zero attached behavior.
- **Don't restructure silently.** If you need to deviate from the existing directory or
  namespace layout, FLAG it and say why before doing it.

## Specific rules (each prevents a real, recurring bug)
- **Settings = one autoloaded option row.** Read/write through the Options primitive. Keep
  logs and any growing/unbounded data OUT of it — use a custom table.
- **Lifecycle:** one registrar for activate/deactivate; `uninstall.php` is canonical (it
  can't be a closure). Uninstall MUST purge everything the plugin created — encrypted secrets,
  the option row, and any custom tables (DROP them). No orphans left in the DB.
- **Hooks via attributes only.** Discovery runs once at boot through the compiled hook-map
  cache — never reflect on the hook-fire / front-end path. New hooks go through the registrar,
  not a raw `add_action`.
- **Every user-facing toggle must actually gate its hooks.** If one toggle covers several
  hooks, ALL of them must stop when it's off. Prove it with a test, not by eye.
- **REST only, one guard.** Admin endpoints use `register_rest_route` (never admin-ajax)
  behind the shared `guard()` (nonce + capability). Don't add an ad-hoc endpoint that skips
  it, and don't duplicate gating logic — route through what already exists.
- **Secrets:** encrypt third-party tokens with the crypto primitive; the key lives outside
  the DB (wp-config constant or WP salts), never in options. Decrypt-failure → null →
  reconnect state.
- **i18n:** never call `__()`/`_e()` before the `init` hook (WP emits a notice on every page
  load). Watch indirect paths — a `__()` inside a defaults builder fires during container
  resolution. Text domain = the plugin slug.
- **External service:** if this plugin calls a third-party API, that fact + what data is sent
  must be disclosed in `readme.txt` (required for wordpress.org review).

## Admin UI: preflight is OFF — new controls are unstyled by default

The settings screen (`resources/views/settings.php`) blends into wp-admin by
reusing WordPress's own classes (`.button`, `.button-primary`, `.button-link`,
`.button-link-delete`, `.notice`, `.wp-list-table`, …). Tailwind's preflight/reset
is **disabled**, and `tw:`-prefixed utilities (v4 CSS-first — `tw:`, not `tw-`) only
handle layout/spacing on our own elements. Consequence: **any new button/input/control
renders raw (default browser chrome) until you give it an explicit native wp-admin
class.** This bites controls added after the initial styling pass.

Definition of done for any new admin control:

1. Give it its native wp-admin class:
   - Primary action → `button button-primary`
   - Secondary action → `button` (add `button-small` for compact)
   - Link-style action → `button-link`
   - Destructive link → `button-link button-link-delete` (BOTH classes — the bare
     `button-link-delete` only sets the red color and renders as a raw button
     without the `button-link` reset).
2. Make sure it's covered by the styling smoke test
   (`tests/e2e/settings.spec.js` → "Admin controls use native wp-admin styling").
   That test fails if any `<button>` / `<a role=button>` / `.button` lacks a
   recognized native class. If a control legitimately uses a non-`.button` core
   class, add it to that test's `ALLOWLIST` rather than skipping the check.
3. A control is not "done" until both of the above are in place.

The smoke test detects *raw/unstyled* controls (no recognized class). It cannot
judge appearance — pair it with a quick visual check when adding novel chrome.

**Cascade caveat:** `tw:` utilities sit in a cascade layer and LOSE to unlayered wp-admin
styles. Where a `tw:` layout/spacing utility is overridden by a wp-admin rule, fix that one
property with the important variant (`tw:mt-1!`, `tw:w-full!`) — surgically, only where it
actually loses. Never re-enable preflight, drop the layer, or blanket-important.