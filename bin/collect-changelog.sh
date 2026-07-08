#!/usr/bin/env bash
#
# Emit the wp.org readme.txt changelog block for a release version.
#
# Sources of truth (nothing is ever retyped by hand):
#   - Membership: merged PRs assigned to the GitHub milestone titled <version>.
#   - Text: each PR body's "### Changelog" section, extracted verbatim.
#
# Usage:
#   bin/collect-changelog.sh <version>        e.g. bin/collect-changelog.sh 1.0.1
#
# STDOUT — the ready-to-paste readme.txt block:
#   = <version> =
#   * entry
#   * entry
#
# STDERR — a "=== REPORT ===" reconcile section:
#   - ORPHANS: PRs merged since the last release tag but NOT in the milestone
#     (unclassified work; warning only — fix by assigning a milestone or the
#     skip-changelog label and re-running).
#   - STALE: PRs in the milestone but not merged since the last release
#     (usually a PR merged before the previous release was tagged; warning only).
#   - TEMPLATE VIOLATIONS: milestone PRs whose body has no "### Changelog"
#     heading at all (the PR template was bypassed) -> exit 1.
#
# A milestone PR whose Changelog section is empty or "N/A" is an INTENTIONAL
# no-entry and is silently skipped.
#
# This script does NOT modify readme.txt — a human pastes the block into the
# release PR. The repo rebase-merges, so PR membership comes from the GitHub
# API, never from "(#N)" markers in commit messages (rebase merges don't add
# them).

set -euo pipefail

version="${1:-}"
if [ -z "$version" ]; then
  echo "Usage: $(basename "$0") <version>   (e.g. $(basename "$0") 1.0.1)" >&2
  exit 2
fi

for dep in gh jq git; do
  command -v "$dep" >/dev/null 2>&1 || { echo "ERROR: '$dep' not found on PATH" >&2; exit 1; }
done

# gh pr list silently truncates at --limit, so every listing warns when a page
# comes back full instead of under-reporting.
LIMIT=200
warn_if_capped() { # $1 = result count, $2 = description of the query
  if [ "$1" -ge "$LIMIT" ]; then
    echo "WARNING: $2 hit the --limit cap ($LIMIT) — results may be truncated." >&2
  fi
}

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# ---------------------------------------------------------------------------
# Baseline: the most recent release tag reachable from main, and its date.
# No tags yet -> baseline is the start of the repo (every merged PR counts).
# ---------------------------------------------------------------------------
baseline_tag=""
baseline_date=""
if baseline_tag="$(git describe --tags --abbrev=0 origin/main 2>/dev/null)"; then
  baseline_date="$(git log -1 --format=%cI "$baseline_tag")"
fi

# ---------------------------------------------------------------------------
# Membership M: merged PRs in the <version> milestone, ordered for stable
# output (mergedAt, then number).
# ---------------------------------------------------------------------------
milestone_json="$(gh pr list --state merged --search "milestone:$version" \
  --json number,title,body,mergedAt -L "$LIMIT" | jq 'sort_by(.mergedAt, .number)')"
m_count="$(jq 'length' <<<"$milestone_json")"
warn_if_capped "$m_count" "milestone:$version PR search"

# ---------------------------------------------------------------------------
# Extraction: slice each PR body from "### Changelog" to the next "### "
# heading (or EOF), drop HTML comments and blank lines, normalize bullets.
# ---------------------------------------------------------------------------
: > "$workdir/entries"
: > "$workdir/violations"

i=0
while [ "$i" -lt "$m_count" ]; do
  number="$(jq -r ".[$i].number" <<<"$milestone_json")"
  title="$(jq -r ".[$i].title" <<<"$milestone_json")"
  body="$(jq -r ".[$i].body // \"\"" <<<"$milestone_json" | tr -d '\r')"
  i=$((i + 1))

  if ! grep -qE '^###[[:space:]]*Changelog' <<<"$body"; then
    echo "PR #$number ($title): body has no '### Changelog' heading" >> "$workdir/violations"
    continue
  fi

  # The section body: after the Changelog heading, up to the next H3 or EOF.
  section="$(awk '
    /^###[[:space:]]*Changelog/ { on = 1; next }
    on && /^### /               { exit }
    on                          { print }
  ' <<<"$body")"

  # Strip <!-- ... --> comments (the PR template ships its guidance in one),
  # including comments spanning multiple lines.
  section="$(awk '
    {
      line = $0; out = ""
      while (length(line)) {
        if (!inc) {
          s = index(line, "<!--")
          if (s) { out = out substr(line, 1, s - 1); line = substr(line, s + 4); inc = 1 }
          else   { out = out line; line = "" }
        } else {
          e = index(line, "-->")
          if (e) { line = substr(line, e + 3); inc = 0 }
          else   { line = "" }
        }
      }
      print out
    }
  ' <<<"$section")"

  # Trim per-line whitespace and drop blank lines.
  section="$(sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' <<<"$section" | sed '/^$/d')"

  # Drop tracker-autolink lines ("Closes ABC-123", "Fixes #42, #43"): they sit
  # in the PR body for issue automation, not for users. Only lines that are
  # NOTHING BUT a closing keyword plus issue references match — a real entry
  # like "Fixed a crash when ..." survives.
  section="$(grep -viE '^(close[sd]?|fix(e[sd])?|resolve[sd]?)([[:space:]]+(([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)?#[0-9]+|[A-Za-z][A-Za-z0-9]*-[0-9]+)[,;]?)+$' <<<"$section" || true)"

  # Empty or a lone "N/A" (any case) = intentionally no user-facing entry.
  if [ -z "$section" ] || [[ "$section" =~ ^[Nn]/[Aa]$ ]]; then
    continue
  fi

  # Normalize every line to a "* " bullet (accepts "-", "*", or bare lines).
  sed -E 's/^[-*][[:space:]]+//' <<<"$section" | sed 's/^/* /' >> "$workdir/entries"
done

# ---------------------------------------------------------------------------
# Reconcile: L = PRs merged after the baseline date.
#   ORPHANS = in L but not in the milestone (unclassified since last release).
#   STALE   = in the milestone but not in L.
# ---------------------------------------------------------------------------
if [ -n "$baseline_date" ]; then
  recent_json="$(gh pr list --state merged --search "merged:>=$baseline_date" \
    --json number,title,mergedAt -L "$LIMIT")"
else
  recent_json="$(gh pr list --state merged --json number,title,mergedAt -L "$LIMIT")"
fi
l_count="$(jq 'length' <<<"$recent_json")"
warn_if_capped "$l_count" "merged-since-baseline PR search"

jq -r '.[].number' <<<"$milestone_json" | sort > "$workdir/m_nums"
jq -r '.[].number' <<<"$recent_json"    | sort > "$workdir/l_nums"

orphan_nums="$(comm -13 "$workdir/m_nums" "$workdir/l_nums")"
stale_nums="$(comm -23 "$workdir/m_nums" "$workdir/l_nums")"

describe_prs() { # $1 = newline-separated PR numbers, $2 = json with number+title
  local n
  while IFS= read -r n; do
    [ -n "$n" ] || continue
    jq -r --argjson n "$n" '.[] | select(.number == $n) | "  - #\(.number) \(.title)"' <<<"$2"
  done <<<"$1"
}

# ---------------------------------------------------------------------------
# Output: the block on STDOUT, the reconcile report on STDERR.
# ---------------------------------------------------------------------------
echo "= $version ="
awk '!seen[$0]++' "$workdir/entries"   # dedup exact-duplicate lines, keep order

{
  echo "=== REPORT ==="
  if [ -n "$baseline_tag" ]; then
    echo "Baseline: tag $baseline_tag ($baseline_date)"
  else
    echo "Baseline: no release tags on main — considering every merged PR"
  fi
  echo "Milestone $version: $m_count merged PR(s)"

  if [ -n "$orphan_nums" ]; then
    echo "ORPHANS — merged since baseline but NOT in milestone $version (assign a milestone or skip-changelog):"
    describe_prs "$orphan_nums" "$recent_json"
  else
    echo "ORPHANS: none"
  fi

  if [ -n "$stale_nums" ]; then
    echo "STALE — in milestone $version but not merged since baseline (check the milestone assignment):"
    describe_prs "$stale_nums" "$milestone_json"
  else
    echo "STALE: none"
  fi

  if [ -s "$workdir/violations" ]; then
    echo "TEMPLATE VIOLATIONS — milestone PRs without a '### Changelog' section:"
    sed 's/^/  - /' "$workdir/violations"
  else
    echo "TEMPLATE VIOLATIONS: none"
  fi
} >&2

# Violations mean the changelog cannot be trusted as complete — fail loud.
[ ! -s "$workdir/violations" ]
