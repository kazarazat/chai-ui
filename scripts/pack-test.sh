#!/usr/bin/env bash
#
# Packaging smoke test: builds and packs @chai-ui/tokens, core and react,
# installs the tarballs into sandbox/consumer-app with npm (as a real user
# would), and builds that app. It exercises each package's exports, files
# and peerDependencies, which workspace symlinks never do. Fully offline:
# nothing is published.
#
# The sandbox uses npm, not pnpm, on purpose: pnpm would fold an install
# there into this workspace's install.
#
# Usage:
#   ./scripts/pack-test.sh          build, pack, install, and build the sandbox
#   ./scripts/pack-test.sh --dev    ...then also boot the sandbox's dev server

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

SANDBOX="sandbox/consumer-app"
TARBALLS="$SANDBOX/.tarballs"

log() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$1" >&2; exit 1; }

log "Building all packages"
pnpm build

log "Packing tokens, core, and react into $TARBALLS"
rm -rf "$TARBALLS"
mkdir -p "$TARBALLS"
ABS_TARBALLS="$(cd "$TARBALLS" && pwd)"

pack_one() {
  local pkg_dir="$1" stable_name="$2" produced
  produced=$(cd "$pkg_dir" && pnpm pack --pack-destination "$ABS_TARBALLS" | tail -1)
  mv "$ABS_TARBALLS/$(basename "$produced")" "$ABS_TARBALLS/$stable_name"
}

pack_one packages/tokens chai-ui-tokens.tgz
pack_one packages/core chai-ui-core.tgz
pack_one packages/react chai-ui-react.tgz

log "Clean-installing the sandbox app from those tarballs (via npm, not pnpm)"
rm -rf "$SANDBOX/node_modules" "$SANDBOX/package-lock.json" "$SANDBOX/dist"
(cd "$SANDBOX" && npm install)

log "Verifying the installed packages actually contain what files/exports promise"
check_file() {
  [ -f "$SANDBOX/node_modules/$1" ] || fail "$1 missing after install — a files/exports/build-step bug that workspace-linking would have hidden."
}
check_file "@chai-ui/tokens/dist/css/tokens.css"
check_file "@chai-ui/core/dist/index.js"
check_file "@chai-ui/react/dist/index.js"
check_file "@chai-ui/react/dist/style.css"

log "Type-checking and building the sandbox app against the installed packages"
(cd "$SANDBOX" && npm run build)

log "Packaging smoke test passed. tokens/core/react all installed, resolved each other correctly, and built as real external dependencies — not workspace links."

if [ "${1:-}" = "--dev" ]; then
  log "Starting the sandbox dev server at http://localhost:5190 (Ctrl+C to stop)"
  (cd "$SANDBOX" && npm run dev)
fi
