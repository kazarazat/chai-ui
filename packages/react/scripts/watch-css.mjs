// `tsc --watch` (the "dev" script's other half) only recompiles TypeScript.
// It never touches the stylesheets, so without this, CSS edits in
// packages/shared/src/ wouldn't reach dist/style.css and
// dist/style-without-fonts.css (what consumers import) until someone runs
// the one-shot "build" script. Keeps them in sync for the life of `pnpm dev`.
import { watch } from "node:fs";
import { buildCss } from "../../shared/build-css.mjs";

function sync() {
  buildCss();
  console.log("[watch-css] synced the shared stylesheets -> dist/");
}

sync();
watch("../shared/src", sync);
