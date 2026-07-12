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

Every PHP and JS source file in the tagged tiers records **when its code was introduced** with a
`@since <version>` docblock tag. A CI gate (`bin/check-since-tags.sh`, also wired into
`composer qa`) fails the build if any file in the tagged tiers below lacks an `@since`.

**Where `@since` goes (granularity):**

- **PHP types** (`class` / `interface` / `trait` / `enum`) → the type's own docblock.
- **View templates** (`resources/views`) and the two **root bootstrap files** (the
  plugin main file + `uninstall.php`) → the file-level header docblock (beside
  `@package` on the root files).
- **JS source modules** (`resources/js`) → the file-level block comment.
- **Format:** bare semver, one space, after any description and before
  `@param`/`@return` — e.g. `@since 1.0.1`.

**Two deliberate deviations from a literal "tag every construct" reading:**

1. **Methods/functions are not tagged at baseline.** Every member of a type shipped in
   the same release as the type, so a per-method `@since` would only restate the type's
   tag. A member carries its own `@since` *only* when introduced after its enclosing
   type (see the going-forward rule).
2. **Class files carry `@since` on the type docblock, not a separate file header.** One
   PSR-4 type per file makes the type docblock the natural, move-safe home; class files
   get no second file-level header.

**Going-forward rule (the standard for new code):**

- A **new type, file, or JS export** gets `@since` at creation.
- A **new member added to an existing type** — a method, or a public constant / enum
  case — gets *its own* `@since`. This is the "when changed" half of the record.
- The **version value = the version of the PR's GitHub milestone** (the same source of
  truth the changelog uses — see *Releasing*). A `skip-changelog` PR that adds a
  construct but carries no milestone uses the milestone of the release it first ships in.

**`@version`** is reserved for a genuinely, independently-versioned file (e.g. a vendored
file tracking its own upstream version). Nothing here is versioned independently today,
so `@version` is applied **nowhere** — a documented rule awaiting a real case.

**Out of scope by design:** `tests/` and build configs (`vite.config.js`,
`playwright.config.js`) are neither tagged nor checked.

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
