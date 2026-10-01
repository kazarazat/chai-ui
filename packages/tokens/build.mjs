#!/usr/bin/env node
// CHAI UI token build.
//
// Reads the single DTCG-flavored source (src/tokens.json) and emits three
// consumers from one source of truth:
//   dist/css/tokens.css        -- CSS custom properties, for any web app
//   dist/js/index.js + .d.ts   -- typed JS/TS exports, for @chai-ui/react and friends
//   dist/figma/tokens.figma.json -- a token set the "Tokens Studio for Figma"
//                                   plugin (or Figma Variables import) can read
//
// No build-tool dependency on purpose: this is small enough to read top to
// bottom, and it's the one part of the repo a designer is as likely to touch
// as an engineer. If this outgrows a single file, reach for Style Dictionary
// then -- the source JSON below is already close to its input shape.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "src", "tokens.json");
const OUT = path.join(__dirname, "dist");

const isToken = (node) =>
  node && typeof node === "object" && "$value" in node;

/** Flatten the nested token tree into { "color.semantic.surface": {$value, $description} } */
function flatten(node, prefix = [], out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    const nextPrefix = [...prefix, key];
    if (isToken(value)) {
      out.set(nextPrefix.join("."), value);
    } else if (value && typeof value === "object") {
      flatten(value, nextPrefix, out);
    }
  }
  return out;
}

/** Resolve `{a.b.c}` references against the flat map. Errors on cycles/missing refs. */
function resolve(flat) {
  const resolved = new Map();
  const resolving = new Set();

  const REF = /^\{([^}]+)\}$/;

  function resolveOne(name) {
    if (resolved.has(name)) return resolved.get(name);
    if (resolving.has(name)) {
      throw new Error(`Circular token reference involving "${name}"`);
    }
    const token = flat.get(name);
    if (!token) throw new Error(`Unknown token reference "${name}"`);
    resolving.add(name);

    let value = token.$value;
    const match = typeof value === "string" && value.match(REF);
    if (match) {
      value = resolveOne(match[1]);
    }
    resolving.delete(name);
    resolved.set(name, value);
    return value;
  }

  for (const name of flat.keys()) resolveOne(name);
  return resolved;
}

function inferType(name, value) {
  if (name.startsWith("color.")) return "color";
  if (name.startsWith("space.")) return "spacing";
  if (name.startsWith("radius.")) return "borderRadius";
  if (name.startsWith("type.size.")) return "fontSizes";
  if (name.startsWith("type.weight.")) return "fontWeights";
  if (name.startsWith("type.leading.")) return "lineHeights";
  if (name.startsWith("type.tracking.")) return "letterSpacing";
  if (name.startsWith("type.family.")) return "fontFamilies";
  if (name.startsWith("motion.duration.")) return "duration";
  if (name.startsWith("shadow.")) return "boxShadow";
  return "other";
}

function toCssVarName(name) {
  // color.semantic.surface -> --chai-color-semantic-surface
  return `--chai-${name.replace(/\./g, "-")}`;
}

// --- MD3 color bridge -------------------------------------------------
//
// @material/web components read theme color only from --md-sys-color-*
// custom properties. Chai owns color: each role in tokens.json's
// color.material group points at a Chai token, and is emitted here as a
// var() reference to that token (not its resolved hex), so overriding a
// Chai token at runtime restyles the Material components too.
function md3CssLines(flat) {
  const REF = /^\{([^}]+)\}$/;
  const lines = [];
  for (const [name, token] of flat.entries()) {
    if (!name.startsWith("color.material.")) continue;
    const ref = typeof token.$value === "string" && token.$value.match(REF);
    if (!ref) throw new Error(`${name} must reference a Chai token, e.g. "{color.semantic.accent}"`);
    lines.push(`  --md-sys-color-${name.slice("color.material.".length)}: var(${toCssVarName(ref[1])});`);
  }
  return [
    "/* Material Design 3 roles, driven by Chai tokens (color.material in src/tokens.json). */",
    ":root {",
    ...lines,
    "}",
    "",
  ];
}

function tokenRefs(flat) {
  const refs = {};
  for (const [name, token] of flat.entries()) {
    const ref = typeof token.$value === "string" && token.$value.match(/^\{([^}]+)\}$/);
    if (ref) refs[name] = ref[1];
  }
  return refs;
}

function toJsPath(name) {
  // color.semantic.surface -> ["color", "semantic", "surface"]
  return name.split(".");
}

function buildNestedObject(resolved) {
  const root = {};
  for (const [name, value] of resolved.entries()) {
    const parts = toJsPath(name);
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      cursor[parts[i]] ??= {};
      cursor = cursor[parts[i]];
    }
    cursor[parts.at(-1)] = value;
  }
  return root;
}

function buildFigmaTokenSet(flat, resolved) {
  // "Tokens Studio for Figma" plugin shape: { <set name>: { group: { token: {value,type} } } }
  const set = {};
  for (const [name, token] of flat.entries()) {
    const parts = toJsPath(name);
    let cursor = set;
    for (let i = 0; i < parts.length - 1; i++) {
      cursor[parts[i]] ??= {};
      cursor = cursor[parts[i]];
    }
    cursor[parts.at(-1)] = {
      value: resolved.get(name),
      type: inferType(name, resolved.get(name)),
      ...(token.$description ? { description: token.$description } : {}),
    };
  }
  return { global: set };
}

async function main() {
  const source = JSON.parse(await readFile(SRC, "utf8"));
  const flat = flatten(source);
  const resolved = resolve(flat);

  await mkdir(path.join(OUT, "css"), { recursive: true });
  await mkdir(path.join(OUT, "js"), { recursive: true });
  await mkdir(path.join(OUT, "figma"), { recursive: true });

  // --- CSS ---
  const cssLines = [
    "/* Generated by @chai-ui/tokens/build.mjs — do not edit by hand. */",
    ":root {",
    // color.material only feeds the --md-sys-color-* bridge below; nothing
    // reads a --chai-color-material-* variable, so none is emitted.
    ...[...resolved.entries()]
      .filter(([name]) => !name.startsWith("color.material."))
      .map(([name, value]) => `  ${toCssVarName(name)}: ${value};`),
    "}",
    "",
    ...md3CssLines(flat),
  ];
  await writeFile(path.join(OUT, "css", "tokens.css"), cssLines.join("\n"));

  // --- JS / TS ---
  const nested = buildNestedObject(resolved);
  const jsLines = [
    "// Generated by @chai-ui/tokens/build.mjs — do not edit by hand.",
    `export const tokens = ${JSON.stringify(nested, null, 2)};`,
    "",
    "/** Flat lookup, e.g. flatTokens[\"color.semantic.accent\"] */",
    `export const flatTokens = ${JSON.stringify(
      Object.fromEntries(resolved),
      null,
      2
    )};`,
    "",
    "/** Alias tokens and what they point at, e.g. tokenRefs[\"color.material.primary\"] === \"color.semantic.accent\" */",
    `export const tokenRefs = ${JSON.stringify(tokenRefs(flat), null, 2)};`,
    "",
    "export default tokens;",
    "",
  ];
  await writeFile(path.join(OUT, "js", "index.js"), jsLines.join("\n"));

  const dtsLines = [
    "// Generated by @chai-ui/tokens/build.mjs — do not edit by hand.",
    "export declare const tokens: Record<string, unknown>;",
    "export declare const flatTokens: Record<string, string>;",
    "export declare const tokenRefs: Record<string, string>;",
    "export default tokens;",
    "",
  ];
  await writeFile(path.join(OUT, "js", "index.d.ts"), dtsLines.join("\n"));

  // --- Figma ---
  const figmaSet = buildFigmaTokenSet(flat, resolved);
  await writeFile(
    path.join(OUT, "figma", "tokens.figma.json"),
    JSON.stringify(figmaSet, null, 2) + "\n"
  );

  console.log(
    `[@chai-ui/tokens] built ${resolved.size} tokens -> css, js, figma`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
