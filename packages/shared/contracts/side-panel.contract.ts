import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { GenerationError, type ChaiEvent, type GenerationEngine, type PageContext } from "@chai-ui/core";
import { wcagViolations } from "./axe.js";
import type { Render } from "./render.js";

/** React-shaped SidePanel props; the Vue side maps `onOpenChange` to `v-model:open`. */
export type SidePanelProps = { title: string } & Record<string, unknown>;

const PAGE: PageContext = { title: "Cutting costs", url: "https://example.com/post", selection: "", text: "Drafts go to a small model." };

/**
 * A stand-in text engine: answers "Answer: <question>", streaming it in two
 * parts, and records every prompt it was sent. `failNext` makes the next
 * call fail.
 */
function fakeEngine() {
  const prompts: string[] = [];
  let failNext = false;
  const engine: GenerationEngine = {
    async generate({ prompt, onText }) {
      prompts.push(prompt);
      await new Promise((r) => setTimeout(r, 20));
      if (failNext) {
        failNext = false;
        throw new GenerationError("The model didn't answer.");
      }
      const answer = `Answer: ${prompt.split("Question: ").pop()}`;
      onText?.(answer.slice(0, 4));
      return { src: answer, kind: "text" };
    },
  };
  return { engine, prompts, failOnce: () => (failNext = true) };
}

const answers = () => [...document.querySelectorAll(".chai-side-panel__answer")].map((el) => el.textContent?.trim());

export function sidePanelContract(render: Render<SidePanelProps>) {
  let screen: ReturnType<Render<SidePanelProps>> | null = null;
  afterEach(() => {
    screen?.unmount();
    screen = null;
  });

  const panel = (props: Record<string, unknown> = {}) => {
    const fake = fakeEngine();
    screen = render({ title: "Northwind Assistant", defaultOpen: true, textEngine: fake.engine, ...props });
    return { screen, ...fake };
  };

  async function ask(text: string) {
    await userEvent.fill(screen!.getByRole("textbox"), text);
    await screen!.getByRole("button", { name: "Submit" }).click();
  }

  describe("SidePanel", () => {
    it("opens from the launcher, and Close clears the conversation", async () => {
      const onEvent = vi.fn<(e: ChaiEvent) => void>();
      const onOpenChange = vi.fn();
      const { screen } = panel({ defaultOpen: false, onEvent, onOpenChange });
      await screen.getByRole("button", { name: "Open Northwind Assistant" }).click();
      await expect.element(screen.getByRole("heading", { name: "Northwind Assistant" })).toBeInTheDocument();
      await ask("Hello");
      await expect.poll(answers).toEqual(["Answer: Hello"]);

      await screen.getByRole("button", { name: "Close" }).click();
      await expect.element(screen.getByRole("button", { name: "Open Northwind Assistant" })).toBeInTheDocument();
      await screen.getByRole("button", { name: "Open Northwind Assistant" }).click();
      expect(answers()).toEqual([]);
      expect(onOpenChange.mock.calls.map((c) => c[0])).toEqual([true, false, true]);
      expect(onEvent.mock.calls.map(([e]) => e.name).filter((n) => n.startsWith("chai_side_panel"))).toEqual([
        "chai_side_panel_opened",
        "chai_side_panel_closed",
        "chai_side_panel_opened",
      ]);
    });

    it("moves focus into the prompt on open, and back to the launcher on Esc", async () => {
      const { screen } = panel({ defaultOpen: false });
      await screen.getByRole("button", { name: "Open Northwind Assistant" }).click();
      await expect.poll(() => document.activeElement?.tagName).toBe("TEXTAREA");
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("Open Northwind Assistant");
    });

    it("closes a menu with Esc before the panel", async () => {
      const { screen } = panel({ pageContext: () => PAGE });
      await userEvent.hover(screen.getByText("This page", { exact: true }));
      await screen.getByRole("button", { name: "Remove This page" }).click();
      await screen.getByRole("button", { name: "Add" }).click();
      await expect.element(screen.getByRole("menuitem", { name: "Use this page" })).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      expect(document.querySelector(".chai-composer__attach-menu")).toBeNull();
      expect(document.querySelector(".chai-side-panel")).not.toBeNull();
    });

    it("doesn't take focus when it starts open", () => {
      panel();
      expect(document.activeElement?.tagName).not.toBe("TEXTAREA");
    });

    it("leaves out the launcher when the builder opens the panel", () => {
      panel({ defaultOpen: false, launcher: false });
      expect(document.querySelector(".chai-side-panel__launcher")).toBeNull();
      expect(document.querySelector(".chai-side-panel")).toBeNull();
    });

    it("sends a prompt tip with one tap, then docks the Composer under the thread", async () => {
      const onEvent = vi.fn<(e: ChaiEvent) => void>();
      const { screen, prompts } = panel({ promptTips: ["Summarize this page", "Draft a reply"], onEvent });
      await expect.element(screen.getByText("Getting started")).toBeInTheDocument();
      await screen.getByRole("button", { name: "Draft a reply" }).click();
      await expect.poll(answers).toEqual(["Answer: Draft a reply"]);
      expect(prompts).toEqual(["Draft a reply"]);
      expect(document.querySelector(".chai-side-panel__tips")).toBeNull();
      expect(document.querySelector(".chai-side-panel__dock .chai-composer")).not.toBeNull();
      expect(onEvent).toHaveBeenCalledWith({ name: "chai_side_panel_tip_used", properties: { index: 1 } });
    });

    it("sends the page while its chip is on, and not once the person removes it", async () => {
      const onEvent = vi.fn<(e: ChaiEvent) => void>();
      const { screen, prompts } = panel({ pageContext: () => PAGE, onEvent });
      await expect.element(screen.getByRole("textbox", { name: "Ask about this page, or ask something else" })).toBeInTheDocument();
      await ask("Summarize");
      await expect.poll(answers).toHaveLength(1);
      expect(prompts[0]).toContain("Page text:\nDrafts go to a small model.");
      await expect.element(screen.getByText("With this page")).toBeInTheDocument();

      // The remove button shows on hover, as on the use-case chip.
      await userEvent.hover(screen.getByText("This page", { exact: true }));
      await screen.getByRole("button", { name: "Remove This page" }).click();
      await expect.element(screen.getByRole("textbox", { name: "Ask anything" })).toBeInTheDocument();
      await ask("Something else");
      await expect.poll(answers).toHaveLength(2);
      expect(prompts[1]).not.toContain("Page text:");
      expect(onEvent).toHaveBeenCalledWith({ name: "chai_side_panel_page_context_toggled", properties: { on: false } });

      await screen.getByRole("button", { name: "Add" }).click();
      await screen.getByRole("menuitem", { name: "Use this page" }).click();
      await expect.element(screen.getByRole("button", { name: "Remove This page" })).toBeInTheDocument();
    });

    it("has no page chip without page context", async () => {
      const { screen } = panel();
      await expect.element(screen.getByRole("textbox", { name: "Ask anything" })).toBeInTheDocument();
      expect(document.querySelector(".chai-composer__chip--context")).toBeNull();
    });

    it("sends earlier turns with a follow-up, and New chat starts over", async () => {
      const { screen, prompts } = panel();
      await ask("First");
      await expect.poll(answers).toEqual(["Answer: First"]);
      await ask("Now shorter");
      await expect.poll(answers).toHaveLength(2);
      expect(prompts[1]).toContain("Person: First\nYou: Answer: First");

      await screen.getByRole("button", { name: "New chat" }).click();
      expect(answers()).toEqual([]);
      await expect.element(screen.getByRole("heading", { name: "Northwind Assistant" })).toBeInTheDocument();
      expect(document.querySelector('[aria-label="New chat"]')).toBeNull();
    });

    it("shows a failed answer with retry, which asks again", async () => {
      const { screen, prompts, failOnce } = panel();
      failOnce();
      await ask("Try me");
      await expect.element(screen.getByRole("alert")).toHaveTextContent("The model didn't answer.");
      await screen.getByRole("button", { name: "Retry" }).click();
      await expect.poll(answers).toEqual(["Answer: Try me"]);
      expect(prompts).toEqual(["Try me", "Try me"]);
    });

    it("keeps a vote per answer", async () => {
      const { screen } = panel();
      await ask("Rate me");
      await expect.poll(answers).toHaveLength(1);
      const like = screen.getByRole("button", { name: "Like", exact: true });
      await like.click();
      await expect.element(like).toHaveAttribute("aria-pressed", "true");
      await like.click();
      await expect.element(like).toHaveAttribute("aria-pressed", "false");
    });

    it("shows each answer in a ResultCard when answers is card", async () => {
      panel({ answers: "card" });
      await ask("Card please");
      await expect.poll(() => document.querySelector(".chai-result-card__text-output")?.textContent).toBe("Answer: Card please");
    });

    it("sits on the side and in the layout it's given", () => {
      panel({ side: "left", mode: "overlay", contained: true });
      const root = document.querySelector(".chai-side-panel")!;
      expect([...root.classList]).toEqual(
        expect.arrayContaining(["chai-side-panel--left", "chai-side-panel--overlay", "chai-side-panel--contained"])
      );
      expect(root.getAttribute("data-chai-page-context")).toBe("skip");
    });

    it("passes axe empty and with an answer", async () => {
      panel({ pageContext: () => PAGE, promptTips: ["Summarize this page"], footer: "Answers can be wrong." });
      expect(await wcagViolations()).toEqual([]);
      await ask("Summarize");
      await expect.poll(answers).toHaveLength(1);
      expect(await wcagViolations()).toEqual([]);
    });
  });
}
