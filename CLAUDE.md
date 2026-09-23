# CLAUDE.md — FastCGI Cache for Ploi

This plugin is built on the **WPForge** base: a reusable kernel in `foundation/`
(namespace `FastCgiCacheForPloi\Foundation\` — the bundled kernel is scoped under the
plugin's own namespace so every shipped class is unique to this plugin, per wordpress.org's
unique-prefix rule; never reintroduce a generic `WPForge\` namespace or a `wpforge_`/`wpf:`
identifier), opt-in features in `modules/` (namespace `FastCgiCacheForPloi\Module\…`), and this
plugin's own code in `src/` (namespace `FastCgiCacheForPloi\`). Read this before changing
anything. When a rule here conflicts with a habit or a quick shortcut, the rule wins.

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
- **Git branches:** never create or switch branches (`git branch`, `git checkout -b`,
  `git switch`/`-c`) unless the user explicitly asks — work on the current branch and commit
  there, even on the default branch.
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

## Admin UI: React inside a scoped reset — wp-admin classes don't work in the mount

The settings screen is React (`resources/js/app`, entry `app/main.tsx`) on shadcn/ui
components (`resources/js/ui`, Base UI primitives), built against the React and
`@wordpress/*` globals core already loads (`wpExternals()` in `vite.config.js`; hence
the WordPress 6.6 minimum, the first with `react-jsx-runtime`). PHP prints only the
mount `#fastcgi-cache-for-ploi-app` (`SettingsPage::APP_ROOT_ID`). `resources/css/app.css`
scopes an unlayered `all: revert` reset plus preflight to that id, and the `tw:` utilities
(v4 CSS-first — `tw:`, not `tw-`) are layered and `important`, so they beat both the
reset and wp-admin.

Consequences (each one has bitten):

- **No wp-admin classes or dashicons inside the mount.** `.button`, `.notice`,
  `.wp-list-table`, `.dashicons-*` are all reverted there: use the shadcn components and
  lucide icons. Never use `.notice` anyway — `common.js` moves `.notice:not(.inline)`
  nodes out of the screen.
- **Inline styles lose to `tw:` utilities** (they are `important`). Style with utilities.
- **Everything portalled (Dialog, Tooltip, Toast) renders into the shared container**
  from `usePortalContainer()` (`ui/portal.tsx`), so it stays inside the reset scope;
  modal layers carry `MODAL_Z` (`tw:z-[100000]`) to clear wp-admin's menu and toolbar.
- **Core ships React 18:** a shadcn component passed to `render=` or given a ref needs
  `React.forwardRef` (`ui/button.tsx` says why). `check:build` (part of `qa:js`) fails
  on a bundled React copy or on a CSS selector outside the mount — never weaken it.
- **shadcn CLI:** `npx shadcn@latest add <name> --yes < /dev/null` (`--dry-run` first;
  if it would overwrite an existing file, move that file aside and restore it after).
  Add the file-level `@since` by hand. Every `tw:data-<word>:` variant the output uses
  must exist: built-ins cover bare attributes (`data-open`, `data-checked`); the rest
  (`data-horizontal`, `data-vertical`) are `@custom-variant`s in `app.css`, checked
  against shadcn's own `tailwind.css`.
- **Strings:** `__()` from `@wordpress/i18n` with the plugin text domain, only in `app/`
  (never in `shared/`: JSON translations are per entry file). After a string change, run
  README → Translations; the pt_BR JSON is committed and keyed to the unhashed `main.js`.
- **Root contract:** React renders `.ploi-cache-admin` with the `data-*` attributes as
  plain props (never through an effect); the E2E page object
  (`tests/e2e/support/settings-page.js`) reads only roles, `data-testid` and those
  attributes.

Definition of done for any UI change: a Vitest through `<App cfg api>` (`tests/js/app`,
`mockApi()` from its fixtures), the E2E suite green on WordPress 6.6 and latest
(`npm run e2e` against each site).
Dev loop: `npm run watch` (no dev server: the externals are build-only).

<!-- contract:claude-contract-block -->
## Project contract

- **[`CONTRIBUTING.md`](CONTRIBUTING.md) is binding** — read it before working in this repo; follow it exactly.
- Blocks between `<!-- contract:* -->` markers and bootstrap-installed files are owned by the cross-project contract that generated them. Never edit them here; change the contract, then re-bootstrap.
<!-- /contract:claude-contract-block -->
