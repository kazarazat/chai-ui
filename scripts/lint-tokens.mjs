#!/usr/bin/env node
// CHAI UI token lint — the guardrail that keeps component CSS on the token
// system, for people and coding agents alike. @chai-ui/tokens is the only
// source of color. Three checks over every packages/*/src/**/*.css file:
//
//   1. Unknown token: every `var(--name)` must name a real custom property —
//      a @chai-ui/tokens token, one defined in the checked CSS itself, one
//      set at runtime from a component's inline style, or a Material
//      component's own `--md-<component>-*` hook. Catches invented
//      (hallucinated) token names, which would otherwise fail silently.
//   2. Color literal: no hex/rgb/hsl color anywhere, custom properties
//      included. Colors live in packages/tokens/src/tokens.json.
//   3. Material color role: no `var(--md-sys-color-*)`. Those are driven
//      by Chai tokens for Material's own components; Chai CSS uses the
//      Chai token behind them.
//   4. Broken comment: every `/*` has its `*/`. A half-deleted comment leaves
//      prose in the stylesheet, and browsers then drop the rule after it.
//
// No dependencies on purpose, same as packages/tokens/build.mjs.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_JSON = path.join(ROOT, "packages", "tokens", "src", "tokens.json");

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
const VAR_REF = /var\(\s*(--[\w-]+)/g;
const RUNTIME_PROP = /["'`](--chai-[\w-]+)["'`]/g;

async function walk(dir, ext, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, ext, out);
    else if (ext.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

/** Same naming packages/tokens/build.mjs uses: color.semantic.surface -> --chai-color-semantic-surface */
function tokenNames(node, prefix = [], out = new Set()) {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$") || !value || typeof value !== "object") continue;
    const next = [...prefix, key];
    if ("$value" in value) out.add(`--chai-${next.join("-")}`);
    else tokenNames(value, next, out);
  }
  return out;
}

/**
 * Splits CSS into declarations with their enclosing selector chain. Small
 * on purpose — enough for this repo's hand-written CSS: comments stripped,
 * `;` inside parens/strings (e.g. data: URLs) not treated as a boundary.
 */
function declarations(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const out = [];
  const stack = [];
  let buf = "";
  let bufLine = 1;
  let line = 1;
  let depth = 0;
  let quote = null;
  const flush = () => {
    const text = buf.trim();
    const colon = text.indexOf(":");
    if (colon > 0 && stack.length) {
      out.push({
        selector: stack.join(" » "),
        property: text.slice(0, colon).trim(),
        value: text.slice(colon + 1).trim().replace(/\s+/g, " "),
        line: bufLine,
      });
    }
    buf = "";
  };
  for (const ch of src) {
    if (!buf.trim()) bufLine = line;
    if (ch === "\n") line++;
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
    } else if (ch === "(") {
      depth++;
      buf += ch;
    } else if (ch === ")") {
      depth--;
      buf += ch;
    } else if (depth === 0 && ch === "{") {
      stack.push(buf.trim().replace(/\s+/g, " "));
      buf = "";
    } else if (depth === 0 && ch === "}") {
      flush();
      stack.pop();
    } else if (depth === 0 && ch === ";") {
      flush();
    } else {
      buf += ch;
    }
  }
  return out;
}

const cssFiles = [];
for (const pkg of await readdir(path.join(ROOT, "packages"))) {
  const src = path.join(ROOT, "packages", pkg, "src");
  try {
    cssFiles.push(...(await walk(src, [".css"])));
  } catch {
    // package without a src/ directory
  }
}

const known = tokenNames(JSON.parse(await readFile(TOKENS_JSON, "utf8")));
for (const file of await walk(path.join(ROOT, "packages"), [".tsx", ".ts"])) {
  for (const [, name] of (await readFile(file, "utf8")).matchAll(RUNTIME_PROP)) known.add(name);
}

const parsed = [];
const brokenComments = [];
for (const file of cssFiles) {
  const css = await readFile(file, "utf8");
  // Comments don't nest, so walking open/close pairs finds a missing half.
  const markers = [...css.matchAll(/\/\*|\*\//g)];
  let open = null;
  for (const m of markers) {
    const line = css.slice(0, m.index).split("\n").length;
    if (m[0] === "/*") {
      if (open === null) open = line;
    } else if (open === null) {
      brokenComments.push(`${path.relative(ROOT, file)}:${line}  "*/" with no "/*" before it`);
    } else {
      open = null;
    }
  }
  if (open !== null) brokenComments.push(`${path.relative(ROOT, file)}:${open}  "/*" never closed`);
  const decls = declarations(css);
  for (const d of decls) if (d.property.startsWith("--")) known.add(d.property);
  parsed.push({ file: path.relative(ROOT, file), decls });
}

const unknown = [];
const literals = [];
const mdRoles = [];
for (const { file, decls } of parsed) {
  for (const d of decls) {
    for (const [, name] of d.value.matchAll(VAR_REF)) {
      if (name.startsWith("--md-sys-color-")) mdRoles.push(`${file}:${d.line}  ${name}`);
      else if (!known.has(name) && !name.startsWith("--md-")) unknown.push(`${file}:${d.line}  ${name}`);
    }
    if (COLOR_LITERAL.test(d.value)) literals.push(`${file}:${d.line}  ${d.property}: ${d.value}`);
  }
}

if (unknown.length) {
  console.error("lint-tokens: var() references a custom property that doesn't exist:");
  for (const u of unknown) console.error(`  ${u}`);
  console.error("  Use a real token from @chai-ui/tokens (see packages/react/DESIGN.md), or define the property first.\n");
}
if (literals.length) {
  console.error("lint-tokens: color literal — colors come from @chai-ui/tokens:");
  for (const l of literals) console.error(`  ${l}`);
  console.error("  Use a var(--chai-color-semantic-*) token, or add a new role to packages/tokens/src/tokens.json.\n");
}
if (mdRoles.length) {
  console.error("lint-tokens: Material color role used directly — use the Chai token it maps to:");
  for (const m of mdRoles) console.error(`  ${m}`);
  console.error("  See color.material in packages/tokens/src/tokens.json for the mapping.\n");
}
if (brokenComments.length) {
  console.error("lint-tokens: broken CSS comment — browsers drop the rule after stray comment text:");
  for (const b of brokenComments) console.error(`  ${b}`);
  console.error("");
}
if (unknown.length || literals.length || mdRoles.length || brokenComments.length) process.exit(1);
console.log(`lint-tokens: ok — ${parsed.length} CSS file(s), no color literals, all tokens known.`);
