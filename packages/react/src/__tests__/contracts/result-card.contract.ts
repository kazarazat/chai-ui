import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import type { ModelOption, Result } from "@chai-ui/core";
import { wcagViolations } from "../axe.js";
import type { Render } from "./render.js";

export interface ResultCardProps {
  results: Result[];
  prompt: string;
  onAction: (action: string, result: Result) => void;
  models?: ModelOption[];
  getVote?: (result: Result) => "like" | "dislike" | null;
  moreActions?: { id: string; label: string }[];
  altText?: (result: Result) => string;
  width?: number;
  textMaxHeight?: number;
}

const svg = (w: number, h: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#09f"/></svg>`)}`;
const MODELS: ModelOption[] = [{ id: "fal/fast", label: "Fast Image", provider: "fal", speed: "fast" }];
const result = (id: string, overrides: Partial<Result> = {}): Result => ({
  id,
  runId: "run",
  modelId: "fal/fast",
  status: "done",
  output: { src: svg(160, 90), kind: "image" },
  ...overrides,
});

export function resultCardContract(render: Render<ResultCardProps>) {
  afterEach(() => vi.restoreAllMocks());

  describe("ResultCard", () => {
    it("pages between results and sends actions for the one showing", async () => {
      const onAction = vi.fn();
      const results = [result("r1"), result("r2"), result("r3")];
      const screen = render({ results, prompt: "a mug", onAction });

      // The second of three 16px dots.
      await screen.getByRole("slider", { name: "Results" }).click({ position: { x: 24, y: 12 } });
      await screen.getByRole("button", { name: "Like" }).first().click();
      expect(onAction).toHaveBeenCalledWith("like", results[1]);
    });

    it("slides the last image out while paging, then drops it", async () => {
      const screen = render({ results: [result("r1"), result("r2")], prompt: "a mug", onAction: () => {} });
      await userEvent.click(screen.getByRole("slider", { name: "Results" }));
      await userEvent.keyboard("{End}");
      expect(document.querySelector(".chai-slide-out--left")).not.toBeNull();
      await Promise.all(document.getAnimations().map((a) => a.finished));
      await expect.poll(() => document.querySelector(".chai-slide-out")).toBeNull();
      expect(document.querySelector(".chai-slide-in")).toBeNull();
    });

    it("names each page's model beside the dots, only when paginated", async () => {
      const models = [
        { id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" as const },
        { id: "fal/slow", label: "Slow", provider: "fal", speed: "slow" as const },
      ];
      const results = [result("r1"), result("r2", { modelId: "fal/slow" })];
      const screen = render({ results, models, prompt: "a mug", onAction: () => {} });
      const label = () => screen.container.querySelector(".chai-card-pager-label");

      expect(label()?.textContent).toBe("Fast");
      await userEvent.click(screen.getByRole("slider", { name: "Results" }));
      await userEvent.keyboard("{End}");
      expect(label()?.textContent).toBe("Slow");
      screen.unmount();

      const single = render({ results: [result("r1")], models, prompt: "a mug", onAction: () => {} });
      expect(single.container.querySelector(".chai-card-pager-label")).toBeNull();
    });

    it("confirms with Link copied when sharing copies the link", async () => {
      // No share sheet here, so Share copies the link.
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      const screen = render({ results: [result("r1")], prompt: "a mug", onAction: () => {} });
      await screen.getByRole("button", { name: "Share" }).click();
      await expect.element(screen.getByRole("button", { name: "Link copied" })).toBeInTheDocument();
      expect(writeText).toHaveBeenCalled();
    });

    it("flips to show the prompt", async () => {
      const screen = render({ results: [result("r1")], prompt: "a red mug on oak", onAction: () => {} });
      await screen.getByRole("button", { name: "Show details" }).click();
      await expect.element(screen.getByText("a red mug on oak")).toBeVisible();
    });

    it("shows a failure's message, and Stopped for a cancelled result", async () => {
      const failed = render(
        { results: [result("e", { status: "error", output: undefined, error: { message: "The model timed out." } })], prompt: "x", onAction: () => {} }
      );
      await expect.element(failed.getByText("The model timed out.")).toBeVisible();
      failed.unmount();

      const stopped = render({ results: [result("c", { status: "cancelled", output: undefined })], prompt: "x", onAction: () => {} });
      await expect.element(stopped.getByText("Stopped")).toBeVisible();
    });

    it("says something went wrong when a failure has no message", async () => {
      const screen = render({ results: [result("e", { status: "error", output: undefined })], prompt: "x", onAction: () => {} });
      await expect.element(screen.getByText("Something went wrong.")).toBeVisible();
    });

    it("plays an audio result with the browser's controls, and offers no Expand", async () => {
      const screen = render({ results: [result("a", { output: { src: "data:audio/mpeg;base64,AA", kind: "audio" } })], prompt: "x", onAction: () => {} });
      const audio = document.querySelector("audio")!;
      expect(audio.controls).toBe(true);
      expect(audio.getAttribute("src")).toBe("data:audio/mpeg;base64,AA");
      await expect.element(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Expand" })).not.toBeInTheDocument();
    });

    it("keeps a stopped stream's partial text", async () => {
      const screen = render(
        { results: [result("t", { status: "cancelled", output: { src: "Once upon a", kind: "text" } })], prompt: "x", onAction: () => {} }
      );
      await expect.element(screen.getByText("Once upon a")).toBeVisible();
    });
  });

  describe("ResultCard info side", () => {
    it("shows the model, usage, timing, shape and evaluations, and copies the prompt", async () => {
      const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
      const onAction = vi.fn();
      const r = result("r1", {
        usage: { promptTokens: 600, completionTokens: 400, totalTokens: 1000, costUsd: 0.0042 },
        durationMs: 3030,
        evaluations: [
          { id: "brand", label: "Brand safe", passed: true },
          { id: "text", label: "Text legible", passed: false },
        ],
      });
      const screen = render({ results: [r], prompt: "a red mug", models: MODELS, onAction });
      await screen.getByRole("button", { name: "Show details" }).click();
      await expect.element(screen.getByRole("button", { name: "Close details" })).toHaveFocus();
      // Focus moves as the flip starts; wait for the 3D turn itself to finish
      // before clicking on the back face.
      await Promise.all(document.getAnimations().map((a) => a.finished));

      for (const chip of ["Fast Image", "16:9"]) await expect.element(screen.getByText(chip, { exact: true })).toBeVisible();
      expect(document.querySelector(".chai-result-card__chips")!.textContent).toMatch(/1(,|\.)?0.*tokens/i);
      expect(document.querySelector(".chai-result-card__chips")!.textContent).toMatch(/\$0\.00/);
      expect(document.querySelector(".chai-result-card__chips")!.textContent).toMatch(/3\.0\d?s/);
      await expect.element(screen.getByTitle("Brand safe: passed")).toBeVisible();
      await expect.element(screen.getByTitle("Text legible: failed")).toBeVisible();

      await screen.getByRole("button", { name: "Copy prompt" }).click();
      await expect.poll(() => writeText.mock.calls.length).toBe(1);
      expect(writeText).toHaveBeenCalledWith("a red mug");
      expect(onAction).toHaveBeenCalledWith("copy-prompt", r);
      await expect.element(screen.getByRole("button", { name: "Copied" })).toBeVisible();

      await screen.getByRole("button", { name: "Close details" }).click();
      await expect.element(screen.getByRole("button", { name: "Show details" })).toHaveFocus();
    });

    it("reads a model still being chosen as such", async () => {
      const screen = render({ results: [result("r", { modelId: "routing", status: "queued", output: undefined })], prompt: "x", onAction: () => {} });
      await screen.getByRole("button", { name: "Show details" }).click();
      await expect.element(screen.getByText("Choosing model…")).toBeVisible();
    });
  });

  describe("ResultCard actions", () => {
    it("sends votes and retry, and shows the vote that's on", async () => {
      const onAction = vi.fn();
      const r = result("r1");
      const screen = render({ results: [r], prompt: "x", getVote: () => "dislike", onAction });
      await expect.element(screen.getByRole("button", { name: "Dislike" })).toHaveAttribute("aria-pressed", "true");
      await screen.getByRole("button", { name: "Dislike" }).click();
      await screen.getByRole("button", { name: "Retry" }).click();
      expect(onAction.mock.calls.map((c) => c[0])).toEqual(["dislike", "retry"]);
    });

    it("opens the ⋯ menu, sends a pick, and closes on Escape or a click outside", async () => {
      const onAction = vi.fn();
      // No text of its own: the screen's queries find the page partly by its text.
      const outside = document.body.appendChild(Object.assign(document.createElement("button"), { ariaLabel: "Outside" }));
      outside.style.cssText = "width: 24px; height: 24px";
      try {
        const screen = render({ results: [result("r1")], prompt: "x", onAction, moreActions: [{ id: "flag", label: "Flag content" }] });
        await screen.getByRole("button", { name: "More" }).click();
        await screen.getByRole("menuitem", { name: "Flag content" }).click();
        expect(onAction).toHaveBeenCalledWith("flag", expect.objectContaining({ id: "r1" }));
        await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();

        await screen.getByRole("button", { name: "More" }).click();
        await userEvent.keyboard("{Escape}");
        await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
        await screen.getByRole("button", { name: "More" }).click();
        await userEvent.click(outside);
        await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      } finally {
        outside.remove();
      }
    });


    it("downloads and shares the result showing", async () => {
      const onAction = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
      const r = result("r1");
      const screen = render({ results: [r], prompt: "x", onAction });
      await screen.getByRole("button", { name: "Download" }).click();
      await expect.poll(() => onAction.mock.calls.length).toBe(1);
      expect(onAction).toHaveBeenCalledWith("download", r);

      await screen.getByRole("button", { name: "Share" }).click();
      await expect.poll(() => onAction.mock.calls.length).toBe(2);
      expect(onAction).toHaveBeenLastCalledWith("share", r);
      if (!("share" in navigator)) expect(writeText).toHaveBeenCalledWith(r.output!.src);
    });

    it("sizes itself from width and textMaxHeight", async () => {
      render({ results: [result("t", { output: { src: "Long text", kind: "text" } })], prompt: "x", width: 300, textMaxHeight: 120, onAction: () => {} });
      const card = document.querySelector<HTMLElement>(".chai-result-card")!;
      expect(card.style.getPropertyValue("--chai-result-card-width")).toBe("300px");
      expect(card.style.getPropertyValue("--chai-result-card-text-max-height")).toBe("120px");
    });
  });

  describe("ResultCard expanded view", () => {
    it("opens a dialog, keeps focus inside, and returns focus to Expand on Escape", async () => {
      const screen = render({ results: [result("r1")], prompt: "a red mug", onAction: () => {} });
      await screen.getByRole("button", { name: "Expand" }).click();
      const dialog = screen.getByRole("dialog", { name: "Expanded image" });
      await expect.element(dialog).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Collapse" })).toHaveFocus();
      await userEvent.keyboard("{Tab}");
      await expect.element(screen.getByRole("button", { name: "Collapse" })).toHaveFocus();
      await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
      await expect.element(screen.getByRole("button", { name: "Collapse" })).toHaveFocus();

      await userEvent.keyboard("{Escape}");
      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Expand" })).toHaveFocus();
    });

    it("closes from the backdrop", async () => {
      const screen = render({ results: [result("r1")], prompt: "x", onAction: () => {} });
      await screen.getByRole("button", { name: "Expand" }).click();
      (document.querySelector(".chai-result-card__expand-scrim") as HTMLElement).click();
      await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("ResultCard video", () => {
    const video = () => result("v", { output: { src: "data:video/mp4;base64,AAAA", kind: "video" } });

    /** Gives the player a duration and a working play/pause, which a test browser can't decode from a stub file. */
    function fakePlayback() {
      const el = document.querySelector("video")!;
      Object.defineProperty(el, "duration", { configurable: true, value: 20 });
      let paused = true;
      Object.defineProperty(el, "paused", { configurable: true, get: () => paused });
      vi.spyOn(el, "play").mockImplementation(() => {
        paused = false;
        el.dispatchEvent(new Event("play"));
        return Promise.resolve();
      });
      vi.spyOn(el, "pause").mockImplementation(() => {
        paused = true;
        el.dispatchEvent(new Event("pause"));
      });
      return el;
    }

    it("plays and pauses from the button", async () => {
      const screen = render({ results: [video()], prompt: "x", onAction: () => {} });
      fakePlayback();
      // The control is a transparent cover over the video; with no real frame
      // to show, Playwright won't treat it as clickable, so click it directly.
      (screen.getByRole("button", { name: "Play" }).element() as HTMLElement).click();
      await expect.element(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
      (screen.getByRole("button", { name: "Pause" }).element() as HTMLElement).click();
      await expect.element(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    });

    it("seeks with the keyboard and by clicking the scrubber", async () => {
      const screen = render({ results: [video()], prompt: "x", onAction: () => {} });
      const el = fakePlayback();
      const seek = screen.getByRole("slider", { name: "Seek" });
      (seek.element() as HTMLElement).focus();
      await userEvent.keyboard("{ArrowRight}");
      expect(el.currentTime).toBe(5);
      await userEvent.keyboard("{ArrowLeft}");
      expect(el.currentTime).toBe(0);
      await userEvent.keyboard("{End}");
      expect(el.currentTime).toBe(20);
      await userEvent.keyboard("{Home}");
      expect(el.currentTime).toBe(0);
      el.dispatchEvent(new Event("timeupdate"));

      const bar = (seek.element() as HTMLElement).getBoundingClientRect();
      (seek.element() as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: bar.left + bar.width / 2, clientY: bar.top + 1 })
      );
      expect(el.currentTime).toBeCloseTo(10, 0);
    });

    it("picks up where the inline player was when expanded, still playing", async () => {
      const screen = render({ results: [video()], prompt: "x", onAction: () => {} });
      const inline = fakePlayback();
      (screen.getByRole("button", { name: "Play" }).element() as HTMLElement).click();
      inline.currentTime = 7;
      inline.dispatchEvent(new Event("timeupdate"));
      await screen.getByRole("button", { name: "Expand" }).click();

      // The expanded player is a second <video>; it loads, then seeks and resumes.
      const expanded = document.querySelector<HTMLVideoElement>('[role="dialog"] video')!;
      const play = vi.spyOn(expanded, "play").mockResolvedValue(undefined);
      expanded.dispatchEvent(new Event("loadedmetadata"));
      expect(expanded.currentTime).toBe(7);
      expect(play).toHaveBeenCalled();
    });

    it("expands into the dialog with its own player", async () => {
      const screen = render({ results: [video()], prompt: "x", onAction: () => {} });
      await screen.getByRole("button", { name: "Expand" }).click();
      await expect.element(screen.getByRole("dialog", { name: "Expanded video" })).toBeVisible();
      expect(document.querySelectorAll(".chai-result-card__scrubber--expanded")).toHaveLength(1);
    });
  });

  describe("ResultCard text", () => {
    it("keeps following streamed text until the reader scrolls up", async () => {
      const long = "word ".repeat(400);
      const running = result("t", { status: "running", output: { src: long, kind: "text" } });
      const screen = render({ results: [running], prompt: "x", textMaxHeight: 100, onAction: () => {} });
      const text = document.querySelector<HTMLElement>(".chai-result-card__text-output")!;
      await expect.poll(() => text.scrollTop).toBeGreaterThan(0);
      text.scrollTop = 0;
      text.dispatchEvent(new Event("scroll"));
      screen.rerender({ results: [{ ...running, output: { src: long + "more ", kind: "text" } }], prompt: "x", textMaxHeight: 100, onAction: () => {} });
      expect(text.scrollTop).toBe(0);
    });
  });

  describe("ResultCard accessibility", () => {
    it("passes axe: paginated image, flipped, loading, text, error and stopped", async () => {
      const screen = render({ results: [result("r1"), result("r2"), result("r3")], prompt: "a mug", onAction: () => {} });
      expect(await wcagViolations()).toEqual([]);
      await screen.getByRole("button", { name: "Show details" }).click();
      expect(await wcagViolations()).toEqual([]);
      screen.unmount();

      render({
        results: [
          result("q", { status: "running", output: undefined }),
          result("t", { output: { src: "A long answer.", kind: "text" } }),
          result("e", { status: "error", output: undefined, error: { message: "Timed out." } }),
          result("c", { status: "cancelled", output: undefined }),
        ],
        prompt: "x",
        onAction: () => {},
      });
      expect(await wcagViolations()).toEqual([]);
    });

    it("gives generated images alt text, defaulting to the prompt", async () => {
      const screen = render({ results: [result("r1")], prompt: "a red mug on oak", onAction: () => {} });
      await expect.element(screen.getByRole("img", { name: "a red mug on oak" })).toBeInTheDocument();
      screen.rerender({ results: [result("r1")], prompt: "x", altText: () => "Custom alt", onAction: () => {} });
      await expect.element(screen.getByRole("img", { name: "Custom alt" })).toBeInTheDocument();
    });

    it("video: play/pause and seek are keyboard controls, and axe passes", async () => {
      const screen = render({ results: [result("v", { output: { src: "data:video/mp4;base64,AAAA", kind: "video" } })], prompt: "a clip", onAction: () => {} });
      await expect.element(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
      const seek = screen.getByRole("slider", { name: "Seek" });
      await expect.element(seek).toHaveAttribute("tabindex", "0");
      await expect.element(seek).toHaveAttribute("aria-valuenow", "0");
      expect(await wcagViolations()).toEqual([]);
    });

    it("the expanded dialog passes axe", async () => {
      const screen = render({ results: [result("r1")], prompt: "a mug", onAction: () => {} });
      await screen.getByRole("button", { name: "Expand" }).click();
      await expect.element(screen.getByRole("dialog", { name: "Expanded image" })).toBeVisible();
      expect(await wcagViolations()).toEqual([]);
    });
  });
}
