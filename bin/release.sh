#!/usr/bin/env bash
#
# release.sh — this plugin's release ADAPTER: the single entry point the release
# skill calls, so the skill itself stays plugin-agnostic. Everything specific to
# this plugin (its file names, its wp.org slug, the qa/e2e commands, the
# individual bin/ checks) is concentrated here, behind a FIXED contract the skill
# hard-codes. Copy this file into another WordPress plugin, keep the contract,
# and the same release skill works there unchanged.
#
# CONTRACT — do NOT rename the verbs or the token keys; the release skill depends
# on them verbatim:
#
#   bin/release.sh env
#       Print the plugin's release facts as eval-able KEY=value lines, read live
#       from the plugin's own files:
#         RELEASE_SLUG        wp.org slug (the repo directory name)
#         RELEASE_MAIN_FILE   main plugin file (the .php carrying the header)
#         RELEASE_README      the readme file (readme.txt)
#         RELEASE_VERSION     the header "Version:" value
#         RELEASE_STABLE      the readme "Stable tag:" value
#         RELEASE_API_URL     the wp.org plugin-info API URL for the slug
#       Use as:  eval "$(bin/release.sh env)"   then $RELEASE_VERSION, etc.
#
#   bin/release.sh preflight <version>
#       Run every read-only pre-release check for release <version>, stopping on
#       the first hard failure, and collect the changelog block to a temp file.
#       In order: SVN deploy-secret presence; `composer qa` (version consistency,
#       @since presence, phpcs, phpstan, tests); an @since-VALUE review (each
#       added @since should equal <version>); `bin/collect-changelog.sh` (block ->
#       temp file, reconcile report -> stderr); `npm run e2e`; `bin/plugin-check.sh`.
#       All check output streams to stderr; STDOUT carries only, on success, the
#       single line `CHANGELOG_FILE=<path>` (the Gate A artifact). Exits non-zero
#       on any hard failure.
#
# The three checks it orchestrates stay standalone and independently runnable;
# this script never reimplements them. Token derivation mirrors the canonical
# methods already used by build.sh (slug, version) and check-version-consistency.sh
# (content-based main-file detection).
#
# Usage:
#   bin/release.sh env
#   bin/release.sh preflight 1.0.2

set -euo pipefail

# Run from the repo root regardless of where the script is invoked from.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# Slug = the repo directory name — the same value build.sh and plugin-check.sh use.
slug="$(basename "$repo_root")"
readme_file="readme.txt"

# Main file found by CONTENT (the top-level .php with a Plugin Name header), not
# by directory name — robust when the checkout dir differs from the slug (as in CI).
find_main_file() {
  local f
  f="$(grep -lE '^[[:space:]]*\*?[[:space:]]*Plugin Name:' ./*.php 2>/dev/null | head -1 || true)"
  printf '%s' "${f#./}"
}

header_version() { # <main_file>
  grep -iE '^[[:space:]]*\*?[[:space:]]*Version:' "$1" | head -1 \
    | sed -E 's/.*Version:[[:space:]]*//' | tr -d '[:space:]' || true
}

readme_stable() { # <readme_file>
  grep -iE '^Stable tag:' "$1" | head -1 | sed -E 's/.*:[[:space:]]*//' | tr -d '[:space:]' || true
}

cmd_env() {
  local main_file version stable
  main_file="$(find_main_file)"
  [ -n "$main_file" ] || { echo "ERROR: no top-level PHP file with a 'Plugin Name:' header" >&2; exit 1; }
  [ -f "$readme_file" ] || { echo "ERROR: $readme_file not found" >&2; exit 1; }
  version="$(header_version "$main_file")"
  stable="$(readme_stable "$readme_file")"
  [ -n "$version" ] || { echo "ERROR: could not read 'Version:' from $main_file" >&2; exit 1; }
  [ -n "$stable" ]  || { echo "ERROR: could not read 'Stable tag:' from $readme_file" >&2; exit 1; }
  printf "RELEASE_SLUG='%s'\n"      "$slug"
  printf "RELEASE_MAIN_FILE='%s'\n" "$main_file"
  printf "RELEASE_README='%s'\n"    "$readme_file"
  printf "RELEASE_VERSION='%s'\n"   "$version"
  printf "RELEASE_STABLE='%s'\n"    "$stable"
  printf "RELEASE_API_URL='%s'\n"   "https://api.wordpress.org/plugins/info/1.0/$slug.json"
}

# Review aid only — surfaces added @since tags whose version != the release, so a
# mis-cited provenance is caught before the changelog is approved. Never fails the
# build (the presence gate is composer qa's `since`; the value is a human call).
since_value_report() { # <version>
  local version="$1" baseline added mismatch line ver
  baseline="$(git describe --tags --abbrev=0 origin/main 2>/dev/null || true)"
  if [ -z "$baseline" ]; then
    echo "  (no prior release tag — skipping @since value review)"
    return 0
  fi
  added="$(git diff "$baseline..HEAD" -- . ':(exclude)vendor' ':(exclude)node_modules' 2>/dev/null \
    | grep -E '^\+[^+].*@since' || true)"
  if [ -z "$added" ]; then
    echo "  (no @since lines added since $baseline)"
    return 0
  fi
  mismatch=0
  while IFS= read -r line; do
    ver="$(grep -oE '@since[[:space:]]+v?[0-9]+\.[0-9]+(\.[0-9]+)?' <<<"$line" \
      | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1 || true)"
    if [ -n "$ver" ] && [ "$ver" != "$version" ]; then
      echo "  REVIEW: @since $ver (expected $version) -> ${line#+}"
      mismatch=1
    fi
  done <<<"$added"
  [ "$mismatch" -eq 0 ] && echo "  all added @since equal $version"
  return 0
}

cmd_preflight() {
  local version="${1:-}"
  [ -n "$version" ] || { echo "Usage: $(basename "$0") preflight <version>" >&2; exit 2; }

  echo "==> [1/6] Deploy-secret presence (SVN_USERNAME, SVN_PASSWORD)" >&2
  local names s
  names="$(gh secret list | awk '{print $1}')"
  for s in SVN_USERNAME SVN_PASSWORD; do
    grep -qx "$s" <<<"$names" || { echo "ERROR: missing GitHub Actions secret: $s" >&2; exit 1; }
  done

  echo "==> [2/6] composer qa (version consistency, @since presence, phpcs, phpstan, tests)" >&2
  composer qa >&2

  echo "==> [3/6] @since value review (each added @since should equal $version)" >&2
  since_value_report "$version" >&2

  echo "==> [4/6] Collecting changelog block" >&2
  local tmpdir="${TMPDIR:-/tmp}"; tmpdir="${tmpdir%/}"
  local changelog_file="$tmpdir/${slug}-changelog-${version}.txt"
  bin/collect-changelog.sh "$version" > "$changelog_file"

  echo "==> [5/6] npm run e2e" >&2
  npm run e2e >&2

  echo "==> [6/6] Plugin Check (WordPress.org PCP gate)" >&2
  bin/plugin-check.sh >&2

  echo >&2
  echo "==> Preflight PASSED for $version — resolve any REVIEW/report warnings above, then Gate A." >&2
  echo "==> Changelog block: $changelog_file" >&2
  echo "CHANGELOG_FILE=$changelog_file"
}

usage() {
  cat >&2 <<'USAGE'
release.sh — this plugin's release adapter (the single entry point the release skill calls).

Commands:
  env                 Print release facts as eval-able KEY=value lines
                      (RELEASE_SLUG, RELEASE_MAIN_FILE, RELEASE_README,
                       RELEASE_VERSION, RELEASE_STABLE, RELEASE_API_URL).
  preflight <version> Run all read-only pre-release checks for <version> and write
                      the changelog block to a temp file (path printed on success
                      as CHANGELOG_FILE=...). Any hard failure exits non-zero.

Examples:
  eval "$(bin/release.sh env)"
  bin/release.sh preflight 1.0.2
USAGE
}

case "${1:-}" in
  env)       shift; cmd_env ;;
  preflight) shift; cmd_preflight "${1:-}" ;;
  -h|--help) usage ;;
  "")        usage; exit 2 ;;
  *)         echo "Unknown command: $1" >&2; echo >&2; usage; exit 2 ;;
esac
