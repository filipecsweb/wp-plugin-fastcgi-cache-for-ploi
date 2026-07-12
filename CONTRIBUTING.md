# Contributing

## Branch naming

```
<gh-username>/<type>[/<id>]/<slug>
```

- **`<gh-username>`** — the GitHub username of the account that owns the branch.
- **`<type>`** — one of `feat` | `fix` | `chore` | `ci` | `docs` | `refactor` | `perf` | `test`.
- **`<id>`** — *optional*: include only when a tracking issue exists; omit the whole segment otherwise. Encode the source: Linear → `linear-<number>`; GitHub → `gh-<number>`.
- **`<slug>`** — short, lowercase, kebab-case.

Examples:

```
<username>/feat/linear-42/add-csv-export
<username>/fix/gh-108/token-refresh-loop
<username>/chore/bump-dependencies (no issue → id segment dropped)
```

One issue per branch is the norm. Issue ↔ branch linking is driven by the PR body and commit messages citing the tracker's native issue key (e.g. a Linear key like `ABC-123`, or a GitHub `#number`) — not by the branch token, which uses `linear-<number>`.

## Pull requests

Follow the PR template: [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).

Every PR must be **classified** before it can merge: it either carries a **version
milestone** (it produces a user-facing changelog entry) or the **`skip-changelog`**
label (it does not). A CI gate enforces this — a PR with neither fails.

## Docblock provenance (`@since` / `@version`)

`@since <version>` (phpDoc) records when code was introduced and when it notably changed.
The CI gate (`bin/check-since-tags.sh`, also in `composer qa`) is **presence-only**: it
fails the build when a tagged-tier file has no `@since`. Per-member completeness and
change-line accuracy are review-enforced (a member-level linter is a possible follow-up).

**PHP — one `@since` per construct:**

- The **type** (`class`/`interface`/`trait`/`enum`), on its own docblock — never a separate
  file header.
- **Every member:** each method (public, protected, **and** private, including abstract and
  interface methods), declared property, constant, and enum case gets its own tag — never
  one shared tag for a group.
- **Parameters get none**, promoted constructor properties included (they are parameters).
- Placement: after any description, before `@param`/`@return`/`@var`, and **above** any
  attribute line; keep existing CONTRACT/WHY/GOTCHA prose.

**JS modules, view templates, and the two root bootstrap files** (`fastcgi-cache-for-ploi.php`,
`uninstall.php`) carry a single **file-level** `@since` only — no per-export or per-member tags.

**Format:** bare semver, one space — `@since 1.0.1`.

**Changes = stacked `@since`, newest-first** (phpDoc reads repeats as a changelog). Add a
line above the introduction line only when a construct's **own** body or signature notably
changes — not when a helper it calls changes, and not for trivial edits (rename, formatting,
comments). Each change line carries a short description; the introduction line carries none.

```php
/**
 * @since 1.0.1 <what changed>
 * @since 1.0.0
 */
```

**Version value = the PR's GitHub milestone** (the changelog's source of truth — see
*Releasing*): a new construct, or a notable own-code change to one, is stamped with that
milestone; a `skip-changelog` PR with no milestone uses the release it first ships in.

**`@version`** is reserved for a genuinely independently-versioned file (e.g. a vendored file
tracking its upstream version) — used **nowhere** today.

**Out of scope:** `tests/` and build configs (`vite.config.js`, `playwright.config.js`).

## Releasing

Each release is a milestone. Name the milestone after the version it ships
(e.g. `x.y.z`) and assign every PR that belongs in that release:

- **User-facing PRs** → the version milestone. Their **Changelog** section
  (from the PR template) becomes one changelog line.
- **Non-user-facing PRs** (CI, refactors, docs, tooling) → the `skip-changelog`
  label, and no milestone.

To cut a release:

1. **Collect the changelog.** Run `bin/collect-changelog.sh <version>`. It reads
   the milestone's merged PRs and prints a `readme.txt` changelog block on stdout;
   a report on stderr flags orphaned PRs (merged, user-facing, no milestone),
   stale entries, and PR-template violations. Resolve anything the report surfaces
   before continuing. Also confirm `@since` provenance: for each PR in the milestone,
   any `@since` it added must equal the milestone version — a re-milestoned PR can
   otherwise leave an `@since` citing a version it no longer ships in.
2. **Open a release PR.** Paste the generated block into `readme.txt` and bump the
   version headers. A human reviews and merges it like any other PR.
3. **Publish the GitHub Release.** Tag the merged release commit and publish a
   Release. Publishing triggers the WordPress.org deploy workflow, which builds
   and ships the plugin.
