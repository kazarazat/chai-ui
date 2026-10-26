// Run from a binding's folder at build (`node ../shared/build-css.mjs`).
// Writes the binding's two stylesheets and copies DESIGN.md:
//   dist/style.css                Roboto (src/fonts.css), then src/style.css
//   dist/style-without-fonts.css  src/style.css alone, for apps with their own font
//   DESIGN.md                     the usage rules, which npm ships
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shared = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(shared, file), "utf8");

export function buildCss(outDir = "dist") {
  const styles = read("src/style.css");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "style.css"), `${read("src/fonts.css")}\n${styles}`);
  writeFileSync(join(outDir, "style-without-fonts.css"), styles);
  copyFileSync(join(shared, "DESIGN.md"), "DESIGN.md");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildCss();
