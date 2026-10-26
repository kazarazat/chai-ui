#!/usr/bin/env bash
#
# Packaging smoke test: builds and packs @chai-ui/tokens, core, react, vue
# and svelte, installs the tarballs with npm (as a real user would) into
# sandbox/consumer-app (React), sandbox/vue-app and sandbox/svelte-app
# (SvelteKit), and builds all three. It exercises each package's exports,
# files and peerDependencies, which workspace symlinks never do. The
# SvelteKit app is then started, to check that the components render on the
# server and that the README's server route answers. Offline: nothing is
# published and no provider is called.
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

log "Packing tokens, core, react, vue and svelte into $TARBALLS"
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
pack_one packages/vue chai-ui-vue.tgz
pack_one packages/svelte chai-ui-svelte.tgz

log "Clean-installing the sandbox app from those tarballs (via npm, not pnpm)"
rm -rf "$SANDBOX/node_modules" "$SANDBOX/package-lock.json" "$SANDBOX/dist"
(cd "$SANDBOX" && npm install)
VUE_SANDBOX="sandbox/vue-app"
rm -rf "$VUE_SANDBOX/node_modules" "$VUE_SANDBOX/package-lock.json" "$VUE_SANDBOX/dist"
(cd "$VUE_SANDBOX" && npm install)
SVELTE_SANDBOX="sandbox/svelte-app"
rm -rf "$SVELTE_SANDBOX/node_modules" "$SVELTE_SANDBOX/package-lock.json" "$SVELTE_SANDBOX/build" "$SVELTE_SANDBOX/.svelte-kit"
(cd "$SVELTE_SANDBOX" && npm install)

log "Verifying the installed packages actually contain what files/exports promise"
check_file() {
  [ -f "$SANDBOX/node_modules/$1" ] || fail "$1 missing after install — a files/exports/build-step bug that workspace-linking would have hidden."
}
check_file "@chai-ui/tokens/dist/css/tokens.css"
check_file "@chai-ui/core/dist/index.js"
check_file "@chai-ui/react/dist/index.js"
check_file "@chai-ui/react/dist/style.css"
[ -f "$VUE_SANDBOX/node_modules/@chai-ui/vue/dist/index.js" ] || fail "@chai-ui/vue/dist/index.js missing after install."
[ -f "$VUE_SANDBOX/node_modules/@chai-ui/vue/dist/style.css" ] || fail "@chai-ui/vue/dist/style.css missing after install."
for f in dist/index.js dist/index.d.ts dist/Composer.svelte dist/style.css DESIGN.md README.md; do
  [ -f "$SVELTE_SANDBOX/node_modules/@chai-ui/svelte/$f" ] || fail "@chai-ui/svelte/$f missing after install."
done
[ ! -e "$SVELTE_SANDBOX/node_modules/@chai-ui/svelte/dist/__tests__" ] || fail "@chai-ui/svelte ships its tests."

log "Type-checking and building the sandbox app against the installed packages"
(cd "$SANDBOX" && npm run build)
(cd "$VUE_SANDBOX" && npm run build)
(cd "$SVELTE_SANDBOX" && npm run build)

log "Starting the SvelteKit build: the page renders on the server, and the server route answers"
PORT=5193
(cd "$SVELTE_SANDBOX" && PORT=$PORT FAL_KEY= node build) > "$SVELTE_SANDBOX/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -sf "http://localhost:$PORT/" > /dev/null && break; sleep 0.2; done
for page in / /edit; do
  html=$(curl -sf "http://localhost:$PORT$page") || fail "SvelteKit $page didn't render. Server log: $(cat "$SVELTE_SANDBOX/server.log")"
  echo "$html" | grep -q 'class="chai-composer' || fail "SvelteKit $page has no server-rendered Composer."
done
route=$(curl -s -X POST "http://localhost:$PORT/api/chai/fal/fal-ai/flux/schnell" -H "content-type: application/json" -d '{}')
echo "$route" | grep -q "FAL_KEY" || fail "The SvelteKit server route didn't answer as expected: $route"
kill $SERVER 2>/dev/null || true

log "Packaging smoke test passed. tokens/core/react/vue/svelte all installed, resolved each other correctly, and built as real external dependencies — not workspace links. SvelteKit rendered on the server."

if [ "${1:-}" = "--dev" ]; then
  log "Starting the sandbox dev server at http://localhost:5190 (Ctrl+C to stop)"
  (cd "$SANDBOX" && npm run dev)
fi
