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
