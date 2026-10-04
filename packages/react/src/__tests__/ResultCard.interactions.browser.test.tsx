import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import type { ModelOption, Result } from "@chai-ui/core";
import { ResultCard } from "../ResultCard.js";

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

afterEach(() => vi.restoreAllMocks());

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
    const screen = render(<ResultCard results={[r]} prompt="a red mug" models={MODELS} onAction={onAction} />);
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
    const screen = render(<ResultCard results={[result("r", { modelId: "routing", status: "queued", output: undefined })]} prompt="x" onAction={() => {}} />);
    await screen.getByRole("button", { name: "Show details" }).click();
    await expect.element(screen.getByText("Choosing model…")).toBeVisible();
  });
});

describe("ResultCard actions", () => {
  it("sends votes and retry, and shows the vote that's on", async () => {
    const onAction = vi.fn();
    const r = result("r1");
    const screen = render(<ResultCard results={[r]} prompt="x" getVote={() => "dislike"} onAction={onAction} />);
    await expect.element(screen.getByRole("button", { name: "Dislike" })).toHaveAttribute("aria-pressed", "true");
    await screen.getByRole("button", { name: "Dislike" }).click();
    await screen.getByRole("button", { name: "Retry" }).click();
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["dislike", "retry"]);
  });

  it("opens the ⋯ menu, sends a pick, and closes on Escape or a click outside", async () => {
    const onAction = vi.fn();
    const screen = render(
      <div>
        <p>Outside</p>
        <ResultCard results={[result("r1")]} prompt="x" onAction={onAction} moreActions={[{ id: "flag", label: "Flag content" }]} />
      </div>
    );
    await screen.getByRole("button", { name: "More" }).click();
    await screen.getByRole("menuitem", { name: "Flag content" }).click();
    expect(onAction).toHaveBeenCalledWith("flag", expect.objectContaining({ id: "r1" }));
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "More" }).click();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "More" }).click();
    await screen.getByText("Outside").click();
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
  });

  it("downloads and shares the result showing", async () => {
    const onAction = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const r = result("r1");
    const screen = render(<ResultCard results={[r]} prompt="x" onAction={onAction} />);
    await screen.getByRole("button", { name: "Download" }).click();
    await expect.poll(() => onAction.mock.calls.length).toBe(1);
    expect(onAction).toHaveBeenCalledWith("download", r);

    await screen.getByRole("button", { name: "Share" }).click();
    await expect.poll(() => onAction.mock.calls.length).toBe(2);
    expect(onAction).toHaveBeenLastCalledWith("share", r);
    if (!("share" in navigator)) expect(writeText).toHaveBeenCalledWith(r.output!.src);
  });

  it("sizes itself from width and textMaxHeight", async () => {
    render(<ResultCard results={[result("t", { output: { src: "Long text", kind: "text" } })]} prompt="x" width={300} textMaxHeight={120} onAction={() => {}} />);
    const card = document.querySelector<HTMLElement>(".chai-result-card")!;
    expect(card.style.getPropertyValue("--chai-result-card-width")).toBe("300px");
    expect(card.style.getPropertyValue("--chai-result-card-text-max-height")).toBe("120px");
  });
});

describe("ResultCard expanded view", () => {
  it("opens a dialog, keeps focus inside, and returns focus to Expand on Escape", async () => {
    const screen = render(<ResultCard results={[result("r1")]} prompt="a red mug" onAction={() => {}} />);
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
    const screen = render(<ResultCard results={[result("r1")]} prompt="x" onAction={() => {}} />);
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
    const screen = render(<ResultCard results={[video()]} prompt="x" onAction={() => {}} />);
    fakePlayback();
    // The control is a transparent cover over the video; with no real frame
    // to show, Playwright won't treat it as clickable, so click it directly.
    (screen.getByRole("button", { name: "Play" }).element() as HTMLElement).click();
    await expect.element(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    (screen.getByRole("button", { name: "Pause" }).element() as HTMLElement).click();
    await expect.element(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("seeks with the keyboard and by clicking the scrubber", async () => {
    const screen = render(<ResultCard results={[video()]} prompt="x" onAction={() => {}} />);
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

  it("expands into the dialog with its own player", async () => {
    const screen = render(<ResultCard results={[video()]} prompt="x" onAction={() => {}} />);
    await screen.getByRole("button", { name: "Expand" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Expanded video" })).toBeVisible();
    expect(document.querySelectorAll(".chai-result-card__scrubber--expanded")).toHaveLength(1);
  });
});

describe("ResultCard text", () => {
  it("keeps following streamed text until the reader scrolls up", async () => {
    const long = "word ".repeat(400);
    const running = result("t", { status: "running", output: { src: long, kind: "text" } });
    const screen = render(<ResultCard results={[running]} prompt="x" textMaxHeight={100} onAction={() => {}} />);
    const text = document.querySelector<HTMLElement>(".chai-result-card__text-output")!;
    await expect.poll(() => text.scrollTop).toBeGreaterThan(0);
    text.scrollTop = 0;
    text.dispatchEvent(new Event("scroll"));
    screen.rerender(<ResultCard results={[{ ...running, output: { src: long + "more ", kind: "text" } }]} prompt="x" textMaxHeight={100} onAction={() => {}} />);
    expect(text.scrollTop).toBe(0);
  });
});
