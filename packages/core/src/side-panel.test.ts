// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  buildSidePanelPrompt,
  readPageContext,
  SIDE_PANEL_HISTORY_LIMIT,
  sidePanelAnswerText,
  sidePanelHistory,
  sidePanelTextPayload,
  tidyPageText,
} from "./side-panel.js";
import type { Result } from "./run.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.title = "";
});

describe("readPageContext", () => {
  it("reads the title, URL and the main text, one block per line", () => {
    document.title = "Cutting costs";
    document.body.innerHTML = `<nav>Menu</nav><main><h1>How we cut costs</h1><p>Drafts go to a small model.</p><p>We cache results.</p></main>`;
    const page = readPageContext();
    expect(page.title).toBe("Cutting costs");
    expect(page.url).toBe(location.href);
    expect(page.text).toBe("How we cut costs\nDrafts go to a small model.\nWe cache results.");
  });

  it("falls back to <article>, then <body>", () => {
    document.body.innerHTML = `<div>Header</div><article><p>The post</p></article>`;
    expect(readPageContext().text).toBe("The post");
    document.body.innerHTML = `<div>Only body</div>`;
    expect(readPageContext().text).toBe("Only body");
  });

  it("skips scripts, the panel and anything the builder excludes", () => {
    document.body.innerHTML = `<main><p>Keep</p><script>bad()</script><aside data-chai-page-context="skip">Panel</aside><div class="ad">Ad</div></main>`;
    expect(readPageContext({ exclude: ".ad" }).text).toBe("Keep");
  });

  it("caps the text", () => {
    document.body.innerHTML = `<main><p>${"a".repeat(50)}</p></main>`;
    expect(readPageContext({ maxLength: 10 }).text).toBe(`${"a".repeat(10)}…`);
  });

  it("reads a given root and leaves the page itself alone", () => {
    document.body.innerHTML = `<main><p>Main</p></main><section id="s"><p>Section</p></section>`;
    expect(readPageContext({ root: document.getElementById("s") }).text).toBe("Section");
    expect(document.body.textContent).toBe("MainSection");
  });
});

describe("tidyPageText", () => {
  it("collapses spaces and keeps paragraph breaks", () => {
    expect(tidyPageText("  a   b \n\n\n\n c  ")).toBe("a b\n\nc");
  });
});

describe("buildSidePanelPrompt", () => {
  const page = { title: "Post", url: "https://example.com/post", selection: "", text: "Body" };

  it("is the question as typed with no page and no history", () => {
    expect(buildSidePanelPrompt({ prompt: "Draft a reply" })).toBe("Draft a reply");
  });

  it("adds the page and still allows unrelated questions", () => {
    const p = buildSidePanelPrompt({ prompt: "Summarize this page", page });
    expect(p).toContain("otherwise answer normally");
    expect(p).toContain("URL: https://example.com/post");
    expect(p).toContain("Page text:\nBody");
    expect(p.endsWith("Question: Summarize this page")).toBe(true);
  });

  it("includes the selection only when there is one", () => {
    expect(buildSidePanelPrompt({ prompt: "q", page })).not.toContain("Selected text");
    expect(buildSidePanelPrompt({ prompt: "q", page: { ...page, selection: "this bit" } })).toContain("Selected text: this bit");
  });

  it("keeps the latest answered turns, oldest first", () => {
    const history = Array.from({ length: SIDE_PANEL_HISTORY_LIMIT + 2 }, (_, i) => ({ prompt: `q${i}`, answer: `a${i}` }));
    history.push({ prompt: "stopped", answer: "" });
    const p = buildSidePanelPrompt({ prompt: "now", history });
    expect(p).not.toContain("Person: q0\n");
    expect(p).not.toContain("stopped");
    expect(p.indexOf("Person: q2")).toBeLessThan(p.indexOf(`Person: q${SIDE_PANEL_HISTORY_LIMIT + 1}`));
  });
});

describe("thread helpers", () => {
  const done = (src: string): Result => ({ id: "r", runId: "u", modelId: "m", status: "done", output: { src, kind: "text" } });

  it("reads a text answer, and nothing from a result without one", () => {
    expect(sidePanelAnswerText(done("Hi"))).toBe("Hi");
    expect(sidePanelAnswerText({ ...done("x"), output: { src: "a.png", kind: "image" } })).toBe("");
    expect(sidePanelAnswerText(undefined)).toBe("");
  });

  it("turns the thread into prompt history", () => {
    const turns = [
      { id: "1", prompt: "Summarize", withPage: true, results: [done("Short")] },
      { id: "2", prompt: "Stopped one", withPage: false, results: [] },
    ];
    expect(sidePanelHistory(turns)).toEqual([
      { prompt: "Summarize", answer: "Short" },
      { prompt: "Stopped one", answer: "" },
    ]);
  });

  it("makes a plain text request", () => {
    const payload = sidePanelTextPayload("Hello");
    expect(payload.value).toBe("Hello");
    expect(payload.selections).toEqual([{ useCase: payload.useCase, modelIds: [], models: [] }]);
    expect(payload.useCase.kind).toBe("text");
  });
});
