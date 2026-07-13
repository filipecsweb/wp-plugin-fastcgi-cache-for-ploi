---
name: release
description: Cut a WordPress.org release of this plugin — the ordered procedure to bump the version, collect the changelog, open/merge the release PR, tag and publish the GitHub Release, watch the wp.org deploy, and close the milestone, with two mandatory human gates (changelog approval before any mutation; approval before the irreversible public deploy). Use when asked to release, publish, ship, or cut a new version of this plugin.
---

# Release runbook

Work the steps in order; honour both gates. The steps drive the plugin through its release adapter,
`bin/release.sh` (verbs `env` and `preflight`).

## Guardrails (hold for every step)

- **Account.** Releases publish under the maintainer's personal GitHub account; before any push or
  publish, confirm the active account via `gh auth status` and `git config user.name`/`user.email`,
  and ask the maintainer if it is ambiguous.
- **Stage only release files.** Never `git add -A`. `git diff --cached --stat` must list exactly the
  files the current step changes, so any unrelated working-tree edit stays unstaged.
- **🚦 Gate A — no mutation before changelog approval.** No bump, branch, or PR until the maintainer
  approves the collected `= x.y.z =` block via **AskUserQuestion** (step 2).
- **🛑 Gate B — no deploy before approval.** Do not create the tag or publish the Release until the
  maintainer approves via **AskUserQuestion** (step 4); publishing is the irreversible wp.org deploy.

## What a release is

- A GitHub **milestone** named `x.y.z`; its merged PRs are the changelog's source.
- Publishing the GitHub Release drives the wp.org deploy (`deploy.yml`); nothing ships before that.

## Procedure

Pre-req: the working tree is clean (resolve or set aside anything dirty first — preflight runs
against whatever is present), `main` is green, the `x.y.z` milestone has **0 open items**, and `main`
already carries all of its merged PRs. Step 1 is read-only — nothing is mutated before Gate A.

1. **Preflight.** Run `bin/release.sh preflight x.y.z`; it must exit 0. Resolve anything its report
   flags **at the source** — fix the PR or milestone and re-run; never hand-edit the block. It prints
   `CHANGELOG_FILE=…`; that block is the Gate A artifact.
2. **🚦 Gate A.** Present the `CHANGELOG_FILE` block to the maintainer via **AskUserQuestion** and get
   an explicit go. Nothing is mutated before this clears.
3. **Release PR** — on a branch off `main` named `<gh-username>/chore/release-x.y.z` (running this
   runbook is the explicit request to create this branch):
   - Bump the plugin header `Version:` and the readme `Stable tag:` to `x.y.z`.
   - Paste the approved block into `readme.txt` under `== Changelog ==`, newest-first. Leave `Tested
     up to` unchanged unless you actually re-tested against a newer WordPress version.
   - Stage only those files.
   - Classify the PR `skip-changelog`, no milestone (the bump is not a user-facing entry).
   - Open against `main`; the commit and PR title are both `chore: release x.y.z`. Wait for `ci.yml`
     + `changelog-guard.yml` green; **rebase-merge** with `--delete-branch`.
4. **🛑 Gate B.** Get the maintainer's explicit go before continuing — everything past here is the
   irreversible public deploy.
5. **Tag + publish the Release.** On a freshly-updated `main`, assert the plugin's version facts equal
   the tag you are about to create, and abort on any mismatch — nothing else guards the tag, and a
   typoed tag ships a mismatched trunk/tag to wp.org:
   ```bash
   git checkout main && git pull --ff-only
   tag=x.y.z   # the exact tag you are about to create
   eval "$(bin/release.sh env)"
   [ "$RELEASE_VERSION" = "$tag" ] && [ "$RELEASE_STABLE" = "$tag" ] \
     || { echo "STAMP/TAG MISMATCH ($RELEASE_VERSION / $RELEASE_STABLE / $tag) — STOP"; exit 1; }
   ```
   Then create tag `x.y.z` on the merged commit and publish a non-prerelease, latest Release; notes =
   the approved `= x.y.z =` block. Publishing fires `deploy.yml`.
6. **Watch the deploy.** `gh run list --workflow=deploy.yml`, then `gh run watch <id> --exit-status`.
   On failure, do not blindly retry (the tag and Release already exist): diagnose the failing step,
   then `gh run rerun <id>` the same run (the deploy workflow serializes, so a rerun is safe). If it
   failed after the SVN tag was created, that partial tag must be removed manually first or the rerun
   will fail re-creating it — report before touching SVN.
7. **Verify wp.org live.** `eval "$(bin/release.sh env)"`, then confirm: the plugin API
   (`$RELEASE_API_URL`) reports version `x.y.z`; SVN `tags/x.y.z/` present; trunk `readme.txt`
   `Stable tag:` == `x.y.z`; page assets at the **top-level** SVN `assets/`. `deploy.yml` pins
   `ASSETS_DIR: .wordpress-org/assets` to keep them there; a nested `assets/assets/` is fixed with an
   asset-only `svn` commit (no version bump).
8. **Close the milestone** — only after the deploy succeeds.

Report at the end: the Release URL, the deploy run's conclusion, the wp.org-live confirmation, and
that the milestone is closed.
