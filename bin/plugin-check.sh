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
#    PCP prints, PER FILE, a "FILE: <path>" header line followed by a single-line
#    JSON array of that file's findings — so the combined stream is NOT one JSON
#    document. A clean run prints a plain "Success:" line and no arrays. PCP also
#    exits non-zero when it finds errors, so we capture without aborting, then
#    parse the raw stream ourselves. (Counting the "type" markers in the raw text
#    is header-agnostic, so it can never silently under-report like a brittle
#    "does it start with [" check would.)
echo "==> [3/3] Running Plugin Check"
mkdir -p dist
timestamp="$(date +%Y%m%d-%H%M%S)"
report="$repo_root/dist/plugin-check-$slug-$timestamp.json"

set +e
raw="$(wp_audit plugin check "$slug" --format=json 2>/dev/null)"

# Merge the per-file arrays into one valid JSON document, tagging each finding
# with its file, so the artifact is greppable JSON rather than the raw FILE:/array
# stream. Falls back to the raw stream when jq is unavailable. A clean run yields [].
if command -v jq >/dev/null 2>&1; then
  printf '%s\n' "$raw" | awk '
    /^FILE: /        { file = substr($0, 7); next }
    /^[[:space:]]*\[/ { gsub(/"/, "\\\"", file); print "{\"file\":\"" file "\",\"items\":" $0 "}" }
  ' | jq -s '[ .[] | .file as $f | .items[] | {file: $f} + . ]' > "$report"
else
  printf '%s\n' "$raw" > "$report"
fi

# Count the type markers in the RAW stream (works regardless of the FILE: headers).
errors="$(printf '%s' "$raw" | grep -o '"type":"ERROR"' | wc -l | tr -d '[:space:]')"
warnings="$(printf '%s' "$raw" | grep -o '"type":"WARNING"' | wc -l | tr -d '[:space:]')"
set -e

echo "==> Done"
echo "    errors:   $errors"
echo "    warnings: $warnings"
echo "    report:   ${report#"$repo_root/"}"

# Surface findings instead of hiding them, and fail the gate on ANY finding — the
# WordPress.org bar this script mirrors is zero errors AND zero warnings.
if [ "$errors" != "0" ] || [ "$warnings" != "0" ]; then
  echo
  echo "==> Findings (human-readable):"
  wp_audit plugin check "$slug" 2>/dev/null || true
  echo
  echo "FAILED: Plugin Check reported $errors error(s) and $warnings warning(s)." >&2
  exit 1
fi

echo "    result:   clean (0 errors, 0 warnings)"
