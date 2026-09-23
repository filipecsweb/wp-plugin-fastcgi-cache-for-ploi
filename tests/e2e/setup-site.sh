#!/usr/bin/env bash
#
# What the specs need from the site beyond a stock install. CI's E2E job runs it
# after activating the plugin; run it once against a local sandbox too.
#
# Usage:
#   tests/e2e/setup-site.sh <WordPress path>

set -euo pipefail

# The bundled-translations spec switches the user to pt_BR, which core only allows for an installed language.
wp language core install pt_BR --path="$1"

# The notice spec needs a notice from code other than this plugin. The fixture prints only for the spec's cookie.
mu_dir=$(wp eval 'echo WPMU_PLUGIN_DIR;' --path="$1")
mkdir -p "$mu_dir"
cp "$(dirname "$0")/support/foreign-notice.php" "$mu_dir/fastcgi-cache-for-ploi-e2e-notice.php"
