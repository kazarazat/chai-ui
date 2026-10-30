/**
 * The side panel's behavior with no framework: what it reads from the page
 * it sits on, and the text prompt each question becomes. Page context is
 * one use case, not the only one: a question sent without it is just the
 * question (plus the conversation so far).
 */

import { TEXT_USE_CASE, type ComposerSubmitPayload } from "./composer.js";
import type { Result } from "./run.js";

/** What the side panel reads from the page: sent with a question only while page context is on. */
export interface PageContext {
  title: string;
  url: string;
  /** The person's selected text, if any. */
  selection: string;
  /** The page's main text, from `<main>`, `<article>` or `<body>`, capped at `maxLength`. */
  text: string;
}

export interface ReadPageContextOptions {
  /** The element to read. Defaults to the page's `<main>`, then `<article>`, then `<body>`. */
  root?: Element | null;
  /** Characters of page text to keep. Defaults to 12,000. */
  maxLength?: number;
  /** Elements to skip, e.g. the panel itself. Anything matching `[data-chai-page-context="skip"]` is always skipped. */
  exclude?: string;
}

export const PAGE_CONTEXT_MAX_LENGTH = 12_000;

const SKIP_SELECTOR = '[data-chai-page-context="skip"], script, style, noscript, template, svg';
const BLOCK_SELECTOR = "p, div, section, article, header, footer, main, aside, nav, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr, br";

/** Collapses runs of whitespace, keeping paragraph breaks, so the text costs fewer tokens. */
export function tidyPageText(text: string): string {
  return text
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Reads the page in the browser. Nothing is sent anywhere: the result goes
 * to the side panel's own prompt, and from there to your engine.
 */
export function readPageContext(options: ReadPageContextOptions = {}): PageContext {
  const maxLength = options.maxLength ?? PAGE_CONTEXT_MAX_LENGTH;
  if (typeof document === "undefined") return { title: "", url: "", selection: "", text: "" };

  const root = options.root ?? document.querySelector("main") ?? document.querySelector("article") ?? document.body;
  let text = "";
  if (root) {
    const copy = root.cloneNode(true) as Element;
    const skip = options.exclude ? `${SKIP_SELECTOR}, ${options.exclude}` : SKIP_SELECTOR;
    copy.querySelectorAll(skip).forEach((el) => el.remove());
    // A detached copy has no layout, so `innerText` can't find the line
    // breaks: mark the end of each block by hand, then read `textContent`.
    copy.querySelectorAll(BLOCK_SELECTOR).forEach((el) => el.append("\n"));
    text = tidyPageText(copy.textContent ?? "");
  }

  return {
    title: document.title,
    url: location.href,
    selection: tidyPageText(window.getSelection()?.toString() ?? ""),
    text: text.length > maxLength ? `${text.slice(0, maxLength)}…` : text,
  };
}

/** One earlier exchange in the panel. */
export interface SidePanelTurn {
  prompt: string;
  /** The answer text, or empty while there's none (failed or stopped). */
  answer: string;
}

export interface SidePanelPromptInput {
  /** What the person asked. */
  prompt: string;
  /** The page, when page context is on for this question. */
  page?: PageContext | null;
  /** Earlier exchanges, oldest first, so a follow-up like "now in Spanish" makes sense. */
  history?: SidePanelTurn[];
}

/** Earlier turns kept in the prompt. Older ones are dropped. */
export const SIDE_PANEL_HISTORY_LIMIT = 6;

/**
 * The text prompt a side-panel question becomes. With no page and no
 * history it's the question as typed, so a plain question costs nothing extra.
 */
export function buildSidePanelPrompt({ prompt, page, history = [] }: SidePanelPromptInput): string {
  const turns = history.filter((t) => t.answer.trim()).slice(-SIDE_PANEL_HISTORY_LIMIT);
  if (!page && turns.length === 0) return prompt;

  const parts: string[] = [];
  if (page) {
    const lines = [`Title: ${page.title}`, `URL: ${page.url}`];
    if (page.selection) lines.push(`Selected text: ${page.selection}`);
    if (page.text) lines.push(`Page text:\n${page.text}`);
    parts.push(
      "The person is looking at this web page. Use it when the question is about the page; otherwise answer normally.\n\n" +
        lines.join("\n")
    );
  }
  if (turns.length > 0) {
    parts.push(
      "The conversation so far:\n\n" + turns.map((t) => `Person: ${t.prompt}\nYou: ${t.answer}`).join("\n\n")
    );
  }
  parts.push(`Question: ${prompt}`);
  return parts.join("\n\n---\n\n");
}

/** The Composer's placeholder: with the page chip on, and without. */
export const SIDE_PANEL_PAGE_PLACEHOLDER = "Ask about this page, or ask something else";
export const SIDE_PANEL_PLACEHOLDER = "Ask anything";

/** One question and its answer, as the panel shows it. */
export interface SidePanelThreadTurn {
  id: string;
  /** What the person asked, as typed. */
  prompt: string;
  /** Whether the page went with this question. */
  withPage: boolean;
  /** Frozen once a newer question is asked; the newest turn shows the live run. */
  results: Result[];
}

/** A result's text answer, or empty when it has none (still queued, failed or stopped). */
export function sidePanelAnswerText(result: Result | undefined): string {
  return result?.output?.kind === "text" ? result.output.src : "";
}

/** The thread as history for `buildSidePanelPrompt`. */
export function sidePanelHistory(turns: SidePanelThreadTurn[]): SidePanelTurn[] {
  return turns.map((t) => ({ prompt: t.prompt, answer: sidePanelAnswerText(t.results[0]) }));
}

/** A plain text request: the panel has no model menu, so the text engine's own model runs. */
export function sidePanelTextPayload(value: string): ComposerSubmitPayload {
  return {
    value,
    attachments: [],
    useCase: TEXT_USE_CASE,
    modelId: null,
    aspectRatio: null,
    selections: [{ useCase: TEXT_USE_CASE, modelIds: [], models: [] }],
    autoSelectModel: false,
  };
}
