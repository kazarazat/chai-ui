// `tsc --watch` (the "dev" script's other half) only recompiles TypeScript —
// it never touches style.css, so without this, CSS edits sit in src/ and
// never reach dist/style.css (what "./style.css" resolves to for consumers)
// until someone runs the one-shot "build" script. Keeps dist/style.css in
// sync with src/style.css for the lifetime of `pnpm dev`.
import { copyFileSync, watch } from "node:fs";

const src = "src/style.css";
const dest = "dist/style.css";

function sync() {
  copyFileSync(src, dest);
  console.log(`[watch-css] synced ${src} -> ${dest}`);
}

sync();
watch(src, sync);
