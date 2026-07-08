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
   before continuing.
2. **Open a release PR.** Paste the generated block into `readme.txt` and bump the
   version headers. A human reviews and merges it like any other PR.
3. **Publish the GitHub Release.** Tag the merged release commit and publish a
   Release. Publishing triggers the WordPress.org deploy workflow, which builds
   and ships the plugin.
