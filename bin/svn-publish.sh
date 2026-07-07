#!/usr/bin/env bash
#
# Prepare the WordPress.org SVN working copy for a release, then STOP before the
# commit. Publishing the working copy stays a human step: it needs the SVN
# password and is irreversible once pushed.
#
# Pipeline:
#   1. Build the distributable ZIP   (delegates to bin/build.sh — the single
#                                      source of truth for WHAT ships: runtime PHP
#                                      + vendor --no-dev + front-end source/build,
#                                      minus every .distignore entry)
#   2. svn checkout                  (the plugin's .org SVN repo -> temp WC)
#   3. Refresh trunk/                (from the freshly built ZIP)
#   4. Snapshot tags/<version>/      (an exact copy of trunk)
#   5. Copy assets/                  (banner/icon/screenshots from
#                                     .wordpress-org/assets/ — these live in SVN
#                                     /assets, never inside the plugin ZIP)
#   6. Stage svn adds + deletes      (SVN does not auto-track like git)
#   7. Print the exact `svn commit`  (you run it after reviewing `svn status`)
#
# Slug + version are derived, never hardcoded: the slug is the repo directory name
# (also the plugin folder and ZIP basename); the version is read from the plugin
# header exactly as bin/build.sh reads it. The header Version and the readme
# Stable tag MUST agree, or the script aborts before touching SVN.
#
# Requirements on PATH: svn, unzip, rsync, plus everything bin/build.sh needs
# (npm, composer, rsync, zip; wp-cli optional).
#
# Usage:
#   bin/svn-publish.sh   # build + stage the SVN working copy, print the commit
#                        # command, and stop (does NOT commit).

set -euo pipefail

SVN_URL="https://plugins.svn.wordpress.org/fastcgi-cache-for-ploi"
SVN_USER="filiprimo"   # WordPress.org username — case-sensitive, NOT the email.

# Run from the repo root regardless of where the script is invoked from.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

slug="$(basename "$repo_root")"
main_file="$slug.php"

# Version is single-sourced from the plugin header (same extraction as build.sh);
# the readme Stable tag must match it or the release is internally inconsistent.
version="$(grep -iE '^[[:space:]]*\*?[[:space:]]*Version:' "$main_file" | head -1 | sed -E 's/.*Version:[[:space:]]*//' | tr -d '[:space:]')"
stable="$(grep -iE '^[[:space:]]*Stable tag:' readme.txt | head -1 | sed -E 's/.*:[[:space:]]*//' | tr -d '[:space:]')"
[ -n "$version" ] || { echo "ERROR: could not read 'Version:' from $main_file" >&2; exit 1; }
[ "$version" = "$stable" ] || { echo "ERROR: header Version ($version) != readme Stable tag ($stable) — fix before publishing." >&2; exit 1; }

# Preconditions this script adds on top of bin/build.sh's own.
for cmd in svn unzip rsync; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: required command not found on PATH: $cmd" >&2; exit 1; }
done

echo "==> Preparing SVN release of $slug v$version (user: $SVN_USER)"

# 1. Build the exact shippable ZIP (delegates — bin/build.sh owns HOW it is built).
echo "==> [1/6] Building distributable ZIP"
bin/build.sh
zip_path="$repo_root/dist/$slug-$version.zip"
[ -f "$zip_path" ] || { echo "ERROR: build did not produce $zip_path" >&2; exit 1; }

# 2. Check out the SVN repo into a throwaway working copy.
echo "==> [2/6] Checking out $SVN_URL"
wc_dir="$(mktemp -d)/svn-wc"
svn checkout "$SVN_URL" "$wc_dir" --username "$SVN_USER"

# 3. Refresh trunk/ from the built ZIP (the ZIP contains a top-level <slug>/ dir).
echo "==> [3/6] Refreshing trunk/"
extract="$(mktemp -d)"
unzip -q "$zip_path" -d "$extract"
mkdir -p "$wc_dir/trunk"
rsync -a --delete "$extract/$slug/" "$wc_dir/trunk/"

# 4. Snapshot trunk -> tags/<version> (a release tag must not already exist).
echo "==> [4/6] Creating tags/$version"
[ -e "$wc_dir/tags/$version" ] && { echo "ERROR: tags/$version already exists in SVN — bump the version." >&2; exit 1; }
mkdir -p "$wc_dir/tags/$version"
rsync -a "$wc_dir/trunk/" "$wc_dir/tags/$version/"

# 5. Copy banner/icon/screenshots -> assets/ (excluding the internal README.md).
echo "==> [5/6] Copying assets/"
mkdir -p "$wc_dir/assets"
rsync -a --exclude='README.md' "$repo_root/.wordpress-org/assets/" "$wc_dir/assets/"

# 6. Stage adds + deletes for SVN: add every new path, then record anything
#    removed since the last release as an svn delete (status '!' = missing).
echo "==> [6/6] Staging svn adds/deletes"
cd "$wc_dir"
svn add --force . >/dev/null
svn status | awk '/^!/ {print $2}' | xargs -r -n1 svn delete >/dev/null || true

echo
echo "==> Staged SVN working copy: $wc_dir"
svn status
echo
echo "Review the list above. When satisfied, PUBLISH with:"
echo "    cd \"$wc_dir\" && svn commit -m \"Release $version\" --username \"$SVN_USER\""
echo
echo "(WordPress.org prompts for your SVN password on the first commit. Nothing"
echo " goes public until that commit lands.)"
