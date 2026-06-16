# ploi-fastcgi-cache — contributor notes

## Admin UI: preflight is OFF — new controls are unstyled by default

The settings screen (`resources/views/settings.php`) blends into wp-admin by
reusing WordPress's own classes (`.button`, `.button-primary`, `.button-link`,
`.button-link-delete`, `.notice`, `.wp-list-table`, …). Tailwind's preflight/reset
is **disabled**, and `tw:`-prefixed utilities only handle layout/spacing on our
own elements. Consequence: **any new button/input/control renders raw (default
browser chrome) until you give it an explicit native wp-admin class.** This bites
controls added after the initial styling pass.

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
