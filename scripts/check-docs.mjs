#!/usr/bin/env node
/**
 * Catches docs that drift from the code as features ship. Run after
 * `pnpm build` (it reads the packages' built exports). Fails on:
 *
 * 1. a repo path in the docs that doesn't exist;
 * 2. a core source file missing from the core README's layout list;
 * 3. a component, hook, factory or constant named in the docs that no
 *    package exports, or a name in DESIGN.md's "don't exist yet" list that
 *    one now does.
 *
 * And warns, without failing, when a pending changeset is a minor or major
 * release and a hand-maintained file (WATCHED) hasn't changed since the
 * last minor release: wording a script can't judge, worth a reread.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

/** Docs read by builders and agents, checked for paths and names. */
const DOCS = [
  "AGENTS.md",
  "README.md",
  "CONTRIBUTING.md",
  "SUPPORT.md",
  "SECURITY.md",
  "packages/core/README.md",
  "packages/react/README.md",
  "packages/vue/README.md",
  "packages/tokens/README.md",
  "packages/react/DESIGN.md",
];

/** Hand-maintained files whose wording only a person (or agent) can check. */
const WATCHED = [...DOCS, ".github/ISSUE_TEMPLATE/bug_report.yml", ".github/PULL_REQUEST_TEMPLATE.md"];

/** Core files deliberately left out of the README's layout list. */
const LAYOUT_SKIP = new Set(["index.ts", "unique-id.ts", "server/index.ts"]);

/** Docs for people changing this repo, which may name internal helpers. */
const CONTRIBUTOR_DOCS = new Set(["AGENTS.md", "CONTRIBUTING.md"]);

/** Names the docs mention that aren't Chai exports: props, the platform, frameworks and other libraries. */
const NOT_CHAI = new Set([
  "useCase", "useCases",
  "AbortSignal", "AbortController", "AbortError", "Promise", "File", "Blob", "Request", "Response", "URL", "Image",
  "ReactNode", "PostHogProvider", "Nuxt", "Next", "React", "Vue", "TypeScript", "JavaScript", "Vite",
  "Express", "Remix", "SvelteKit", "Fal", "OpenRouter", "Chromium", "MediaRecorder", "Turborepo",
]);

const errors = [];
const warnings = [];

/** A doc's text, without blocks a tool manages (Turborepo's, which describes its own package). */
const docText = (doc) => read(doc).replace(/<!-- BEGIN:[\s\S]*?<!-- END:[^>]*-->/g, "");

// 1. Paths. A backticked token shaped like a file path passes when a
// tracked file (or folder) ends with it, so docs can write `run.ts` or
// `engines/fal.ts` as well as full paths.
const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const folders = new Set(tracked.flatMap((f) => f.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/") + "/")));
const pathExists = (token) =>
  token.endsWith("/")
    ? [...folders].some((d) => d === token || d.endsWith(`/${token}`))
    : tracked.some((f) => f === token || f.endsWith(`/${token}`));
for (const doc of DOCS) {
  for (const [, token] of docText(doc).matchAll(/`([^`\s]+)`/g)) {
    if (!/^[\w.-]+(\/[\w.-]+)*\/?$/.test(token)) continue;
    if (!/\.(ts|tsx|vue|mjs|js|json|md|yml|yaml|css|sh)$|\/$/.test(token)) continue;
    // Build output (`dist/…`) isn't tracked, but exists next to the doc after `pnpm build`.
    const built = existsSync(join(root, dirname(doc), token));
    if (!pathExists(token) && !built) errors.push(`${doc}: \`${token}\` doesn't exist`);
  }
}

// 2. The core README's layout list covers every core source file.
const coreSrc = join(root, "packages/core/src");
const sourceFiles = (dir, prefix = "") =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sourceFiles(join(dir, e.name), `${prefix}${e.name}/`)
      : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")
        ? [`${prefix}${e.name}`]
        : []
  );
const layout = read("packages/core/README.md").match(/## Layout\n([\s\S]*?)\n## /)?.[1] ?? "";
for (const file of sourceFiles(coreSrc)) {
  if (LAYOUT_SKIP.has(file) || file.startsWith("__tests__/")) continue;
  const name = file.split("/").pop();
  if (!layout.includes(`\`${file}\``) && !layout.includes(`(\`${name}\`)`)) {
    errors.push(`packages/core/README.md: the Layout list is missing \`${file}\``);
  }
}

// 3. Names. Every exported name, read from the built type declarations.
const exported = new Set();
const collect = (file, seen = new Set()) => {
  if (seen.has(file) || !existsSync(file)) return;
  seen.add(file);
  const text = readFileSync(file, "utf8");
  for (const [, name] of text.matchAll(/export (?:declare )?(?:interface|type|function|const|class|enum|let) (\w+)/g)) exported.add(name);
  for (const [, list] of text.matchAll(/export (?:type )?\{([^}]*)\}/g)) {
    for (const part of list.split(",")) {
      const name = part.trim().replace(/^type /, "").split(/\s+as\s+/).pop()?.trim();
      if (name) exported.add(name);
    }
  }
  for (const [, from] of text.matchAll(/export \* from ["'](\.[^"']+)["']/g)) {
    collect(join(dirname(file), from.replace(/\.js$/, ".d.ts")), seen);
  }
};
for (const pkg of ["core", "react", "vue"]) {
  const dts = join(root, `packages/${pkg}/dist/index.d.ts`);
  if (!existsSync(dts)) {
    console.error(`check-docs: run \`pnpm build\` first (no ${relative(root, dts)}).`);
    process.exit(1);
  }
  collect(dts);
}
collect(join(root, "packages/core/dist/server/index.d.ts"));

const isApiName = (n) =>
  !NOT_CHAI.has(n) &&
  (/^(create|use|build|check|route|suggested|parse|fit|next|to)[A-Z]\w*$/.test(n) ||
    (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(n) && !/_(KEY|TOKEN|SECRET|URL)$/.test(n)) ||
    /^[A-Z][a-z]+[A-Z]\w*$/.test(n));

/** Whether the source defines `name` at all, exported or not (for contributor docs). */
const sourceDefines = (name) =>
  tracked.some((f) => /^packages\/[^/]+\/src\/.*\.(ts|tsx|vue)$/.test(f) && new RegExp(`(function|const|class) ${name}\\b`).test(read(f)));

const design = read("packages/react/DESIGN.md");
const notYet = (design.match(/These don't exist yet\.[\s\S]*?\n\n/)?.[0].match(/`(\w+)`/g) ?? []).map((n) => n.slice(1, -1));
for (const name of notYet) {
  if (exported.has(name)) errors.push(`packages/react/DESIGN.md: \`${name}\` is listed as not existing, but it's exported`);
}
for (const doc of DOCS) {
  for (const [, name] of docText(doc).matchAll(/`(\w+)`/g)) {
    if (CONTRIBUTOR_DOCS.has(doc) && sourceDefines(name)) continue;
    if (isApiName(name) && !exported.has(name) && !notYet.includes(name)) {
      errors.push(`${doc}: \`${name}\` isn't exported by any package`);
    }
  }
}

// 4. On a minor or major release, hand-maintained files untouched since
// the last minor release, as warnings.
const pending = existsSync(join(root, ".changeset"))
  ? readdirSync(join(root, ".changeset")).filter((f) => f.endsWith(".md") && f !== "README.md")
  : [];
const isMinor = pending.some((f) => /":\s*(minor|major)/.test(read(`.changeset/${f}`)));
if (isMinor) {
  try {
    const tags = execSync("git tag --list '@chai-ui/core@*.0'", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
    const version = (t) => t.split("@").pop().split(".").map(Number);
    const last = tags.sort((a, b) => version(a)[0] - version(b)[0] || version(a)[1] - version(b)[1]).pop();
    if (!last) throw new Error("no release tags");
    for (const file of WATCHED) {
      const changed = execSync(`git log --format=%h ${last}..HEAD -- "${file}"`, { cwd: root, encoding: "utf8" }).trim();
      if (!changed) warnings.push(`${file} hasn't changed since ${last}: reread it against this release's changesets`);
    }
  } catch {
    warnings.push("couldn't read release tags (CI needs fetch-depth: 0), so the watched files weren't checked");
  }
}

const inCi = Boolean(process.env.GITHUB_ACTIONS);
for (const w of warnings) console.log(inCi ? `::warning::${w}` : `warning: ${w}`);
for (const e of errors) console.log(inCi ? `::error::${e}` : `error: ${e}`);
console.log(`check-docs: ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length > 0 ? 1 : 0);
