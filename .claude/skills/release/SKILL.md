---
name: release
description: Cut a WordPress.org release of this plugin — the ordered procedure to bump the version, collect the changelog, open/merge the release PR, tag and publish the GitHub Release, watch the wp.org deploy, and close the milestone, with two mandatory human gates (changelog approval before any mutation; approval before the irreversible public deploy). Use when asked to release, publish, ship, or cut a new version of this plugin.
allowed-tools: Bash(gh:*) Bash(git:*) Bash(composer:*) Bash(npm:*) Bash(bin/collect-changelog.sh:*) Bash(bin/check-since-tags.sh:*) Bash(bin/plugin-check.sh:*) Bash(curl:*) Bash(grep:*) Bash(sed:*) Bash(head:*) Bash(tr:*) Read Edit
---

# Release runbook

Cutting a release bumps the version, opens and merges a PR, tags the commit, and publishes to
WordPress.org — public and irreversible once shipped. Work the steps in order; honour both gates.

## Guardrails (hold for every step)

- **Account.** Releases publish under the maintainer's personal GitHub account; before any push or
  publish, confirm the active account via `gh auth status` and `git config user.name`/`user.email`,
  and ask the maintainer if it is ambiguous.
- **Stage only release files.** Never `git add -A`. `git diff --cached --stat` must list exactly the
  files the current step changes, so any unrelated working-tree edit stays unstaged.
- **🚦 Gate A — no mutation before changelog approval.** No bump, branch, or PR until the maintainer
  approves the collected `= x.y.z =` block via **AskUserQuestion** (step 5).
- **🛑 Gate B — no deploy before approval.** Do not create the tag or publish the Release until the
  maintainer approves via **AskUserQuestion** (step 7); publishing is the irreversible wp.org deploy.

## What a release is

- A GitHub **milestone** named `x.y.z`; its merged PRs are the input to `bin/collect-changelog.sh`.
- Whether a PR carries the milestone or the `skip-changelog` label is defined in
  [CONTRIBUTING → Pull requests](../../../CONTRIBUTING.md#pull-requests) — follow it, don't restate it.
- Publishing the GitHub Release drives the wp.org deploy (`deploy.yml`); nothing ships before that.

## Procedure

Pre-req: the working tree is clean (resolve or set aside anything dirty first — `composer qa` runs
against whatever is present), `main` is green, the `x.y.z` milestone has **0 open items**, and `main`
already carries all of its merged PRs. Steps 1–4 are read-only — nothing is mutated before Gate A.

1. **Pre-flight QA + deploy secrets.** Run `composer qa` and `npm run e2e` (CI runs the same). Confirm
   the deploy secrets exist now: `gh secret list` must show `SVN_USERNAME` and `SVN_PASSWORD` (names
   only — never print values). Missing → fix before Gate A.
2. **Collect the changelog.** Run `bin/collect-changelog.sh x.y.z`. Keep its stdout `= x.y.z =` block
   for Gate A; before continuing, act on its stderr report per the script's own documented exit
   semantics — a hard failure blocks, warnings are resolved at their source.
3. **Verify `@since` values.** `bin/check-since-tags.sh` checks presence, not the value — so
   enumerate the additions with `git diff $(git describe --tags --abbrev=0)..main | grep -E '^\+.*@since'`
   and confirm every added value equals `x.y.z`.
4. **Plugin Check.** Run `bin/plugin-check.sh`; it must pass clean (0 errors / 0 warnings).
5. **🚦 Gate A.** Present the step-2 block, confirm its report was resolved, and get an explicit go. A
   wrong block is fixed at the source PRs/milestone and step 2 re-run — never hand-edited.
6. **Release PR** — on a branch off `main` named per
   [CONTRIBUTING → Branch naming](../../../CONTRIBUTING.md#branch-naming), e.g.
   `<gh-username>/chore/release-x.y.z` (invoking this runbook is the explicit request the project
   `CLAUDE.md` requires before creating a branch):
   - Bump `Version:` (plugin header) and `Stable tag:` (readme) to `x.y.z`.
   - Paste the approved block into `readme.txt` under `== Changelog ==`, newest-first. Leave `Tested
     up to` unchanged unless you actually re-tested against a newer WordPress version.
   - Stage only those files.
   - Classify the PR `skip-changelog`, no milestone (the bump is not a user-facing entry).
   - Open against `main`; the commit and PR title are both `chore: release x.y.z`. Wait for `ci.yml`
     + `changelog-guard.yml` green; **rebase-merge** with `--delete-branch`.
7. **🛑 Gate B.** Get the maintainer's explicit go before continuing — everything past here is the
   irreversible public deploy.
8. **Tag + publish the Release.** On a freshly-updated `main`, assert the plugin header `Version:` and
   the readme `Stable tag:` both equal the tag you are about to create, and abort on any mismatch —
   nothing else guards the tag, and a typoed tag ships a mismatched trunk/tag to wp.org:
   ```bash
   git checkout main && git pull --ff-only
   tag=x.y.z   # the exact tag you are about to create
   ver=$(grep -iE '^[[:space:]]*\*?[[:space:]]*Version:' fastcgi-cache-for-ploi.php | head -1 | sed -E 's/.*Version:[[:space:]]*//' | tr -d '[:space:]')
   stable=$(grep -iE '^Stable tag:' readme.txt | head -1 | sed -E 's/.*:[[:space:]]*//' | tr -d '[:space:]')
   [ "$ver" = "$tag" ] && [ "$stable" = "$tag" ] || { echo "STAMP/TAG MISMATCH ($ver / $stable / $tag) — STOP"; exit 1; }
   ```
   Then create tag `x.y.z` on the merged commit and publish a non-prerelease, latest Release; notes =
   the `= x.y.z =` bullets. Publishing fires `deploy.yml`.
9. **Watch the deploy.** `gh run list --workflow=deploy.yml`, then `gh run watch <id> --exit-status`.
   On failure, do not blindly retry (the tag and Release already exist): diagnose the failing step,
   then `gh run rerun <id>` the same run (the deploy workflow serializes, so a rerun is safe). If it
   failed after the SVN tag was created, that partial tag must be removed manually first or the rerun
   will fail re-creating it — report before touching SVN.
10. **Verify wp.org live.** Plugin API version == `x.y.z`
    (`https://api.wordpress.org/plugins/info/1.0/fastcgi-cache-for-ploi.json`); SVN `tags/x.y.z/`
    present; trunk `readme.txt` `Stable tag:` == `x.y.z`; page assets at the **top-level** SVN
    `assets/`. `deploy.yml` pins `ASSETS_DIR: .wordpress-org/assets` to keep them there; a nested
    `assets/assets/` is fixed with an asset-only `svn` commit (no version bump).
11. **Close the milestone** — only after the deploy succeeds.

Report at the end: the Release URL, the deploy run's conclusion, the wp.org-live confirmation, and
that the milestone is closed.
