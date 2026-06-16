#!/usr/bin/env bash
#
# Build the plugin, force-install it into the local audit WordPress, and run
# WordPress.org's Plugin Check (PCP) against it — the same gate the .org review
# team runs. The full machine-readable report is saved as a timestamped JSON
# artifact under dist/ so it can be read after the run.
#
# Pipeline:
#   1. Build the distributable ZIP   (delegates to bin/build.sh — single source
#                                      of truth for HOW the artifact is built)
#   2. Force-install it              (wp plugin install <zip> --force)
#   3. Run Plugin Check              (wp plugin check <slug> --format=json)
#                                     -> dist/plugin-check-<slug>-<timestamp>.json
#
# The slug is derived, never hardcoded: it is the repo directory name, which is
# also the plugin folder name and the ZIP basename produced by bin/build.sh.
#
# The audit WordPress defaults to ~/Herd/plugin-audit and can be overridden:
#   PLUGIN_AUDIT_WP=/path/to/wp bin/plugin-check.sh
# It must be a working WP install with the `plugin-check` plugin active.
#
# Requirements on PATH: wp (WP-CLI), plus everything bin/build.sh needs.
#
# Usage:
#   bin/plugin-check.sh        build, install, check; restore dev deps afterward

set -euo pipefail

# Run from the repo root regardless of where the script is invoked from.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# The audit WordPress install (Bedrock layout: WP core under web/wp). Override
# with PLUGIN_AUDIT_WP. We address it explicitly via --path so this script does
# not depend on the caller's working directory or that install's wp-cli.yml.
audit_wp="${PLUGIN_AUDIT_WP:-$HOME/Herd/plugin-audit}"
wp_path="$audit_wp/web/wp"

# Slug is single-sourced from the repo directory name — same value bin/build.sh
# uses for the ZIP and the plugin folder. Never hardcode it for the check.
slug="$(basename "$repo_root")"
main_file="$slug.php"

case "${1:-}" in
  -h|--help)
    cat <<USAGE
Build, force-install, and Plugin Check the plugin against the audit WordPress.

Steps: bin/build.sh  ->  wp plugin install <zip> --force  ->  wp plugin check.
The JSON report is written to dist/plugin-check-<slug>-<timestamp>.json.

Audit install: \$PLUGIN_AUDIT_WP (default: \$HOME/Herd/plugin-audit), which must
have the 'plugin-check' plugin active.

Usage:
  bin/plugin-check.sh        build, install, check
USAGE
    exit 0 ;;
  "") ;;
  *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
esac

# Version is single-sourced from the plugin header (same extraction as build.sh)
# so we can locate the exact ZIP bin/build.sh produces.
version="$(grep -iE '^[[:space:]]*\*?[[:space:]]*Version:' "$main_file" | head -1 | sed -E 's/.*Version:[[:space:]]*//' | tr -d '[:space:]')"
[ -n "$version" ] || { echo "ERROR: could not read 'Version:' from $main_file" >&2; exit 1; }

zip_path="$repo_root/dist/$slug-$version.zip"

# Preconditions.
command -v wp >/dev/null 2>&1 || { echo "ERROR: WP-CLI ('wp') not found on PATH" >&2; exit 1; }
[ -d "$wp_path" ] || { echo "ERROR: audit WordPress not found at $wp_path (set PLUGIN_AUDIT_WP)" >&2; exit 1; }

wp_audit() { wp --path="$wp_path" "$@"; }

wp_audit core is-installed >/dev/null 2>&1 || { echo "ERROR: no working WordPress at $wp_path" >&2; exit 1; }
wp_audit plugin is-active plugin-check >/dev/null 2>&1 || { echo "ERROR: the 'plugin-check' plugin is not active in $wp_path" >&2; exit 1; }

echo "==> Plugin Check pipeline for $slug v$version"
echo "    audit WordPress: $wp_path"

# 1. Build the distributable ZIP (delegates — bin/build.sh owns HOW it is built).
echo "==> [1/3] Building distributable ZIP"
bin/build.sh
[ -f "$zip_path" ] || { echo "ERROR: build did not produce $zip_path" >&2; exit 1; }

# 2. Force-install the freshly built ZIP into the audit WordPress.
echo "==> [2/3] Force-installing $slug-$version.zip"
wp_audit plugin install "$zip_path" --force

# 3. Run Plugin Check and persist the report.
#    When PCP finds nothing it prints a plain "Success:" line (not JSON), and it
#    exits non-zero when it finds errors. Capture both so we always write valid
#    JSON ([] when clean) and never let a findings exit code abort the script.
echo "==> [3/3] Running Plugin Check"
mkdir -p dist
timestamp="$(date +%Y%m%d-%H%M%S)"
report="$repo_root/dist/plugin-check-$slug-$timestamp.json"

set +e
raw="$(wp_audit plugin check "$slug" --format=json 2>/dev/null)"
set -e

case "$raw" in
  \[*|\{*) printf '%s\n' "$raw" > "$report" ;;   # real JSON findings
  *)       printf '[]\n'        > "$report" ;;    # "Success:" / empty -> no findings
esac

errors="$(grep -o '"type":"ERROR"' "$report" | wc -l | tr -d '[:space:]')"
warnings="$(grep -o '"type":"WARNING"' "$report" | wc -l | tr -d '[:space:]')"

echo "==> Done"
echo "    errors:   $errors"
echo "    warnings: $warnings"
echo "    report:   ${report#"$repo_root/"}"
