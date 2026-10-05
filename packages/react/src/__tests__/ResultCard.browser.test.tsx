import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import type { Result } from "@chai-ui/core";
import { ResultCard } from "../ResultCard.js";

const svg = (fill: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="${fill}"/></svg>`)}`;
const result = (id: string, overrides: Partial<Result> = {}): Result => ({
  id,
  runId: "run",
  modelId: "fal/fast",
  status: "done",
  output: { src: svg("#09f"), kind: "image" },
  ...overrides,
});

describe("ResultCard", () => {
  it("pages between results and sends actions for the one showing", async () => {
    const onAction = vi.fn();
    const results = [result("r1"), result("r2"), result("r3")];
    const screen = render(<ResultCard results={results} prompt="a mug" onAction={onAction} />);

    // The second of three 16px dots.
    await screen.getByRole("slider", { name: "Results" }).click({ position: { x: 24, y: 12 } });
    await screen.getByRole("button", { name: "Like" }).first().click();
    expect(onAction).toHaveBeenCalledWith("like", results[1]);
  });

  it("names each page's model beside the dots, only when paginated", async () => {
    const models = [
      { id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" as const },
      { id: "fal/slow", label: "Slow", provider: "fal", speed: "slow" as const },
    ];
    const results = [result("r1"), result("r2", { modelId: "fal/slow" })];
    const screen = render(<ResultCard results={results} models={models} prompt="a mug" onAction={() => {}} />);
    const label = () => screen.container.querySelector(".chai-card-pager-label");

    expect(label()?.textContent).toBe("Fast");
    await userEvent.click(screen.getByRole("slider", { name: "Results" }));
    await userEvent.keyboard("{End}");
    expect(label()?.textContent).toBe("Slow");
    screen.unmount();

    const single = render(<ResultCard results={[result("r1")]} models={models} prompt="a mug" onAction={() => {}} />);
    expect(single.container.querySelector(".chai-card-pager-label")).toBeNull();
  });

  it("flips to show the prompt", async () => {
    const screen = render(<ResultCard results={[result("r1")]} prompt="a red mug on oak" onAction={() => {}} />);
    await screen.getByRole("button", { name: "Show details" }).click();
    await expect.element(screen.getByText("a red mug on oak")).toBeVisible();
  });

  it("shows a failure's message, and Stopped for a cancelled result", async () => {
    const failed = render(
      <ResultCard results={[result("e", { status: "error", output: undefined, error: { message: "The model timed out." } })]} prompt="x" onAction={() => {}} />
    );
    await expect.element(failed.getByText("The model timed out.")).toBeVisible();
    failed.unmount();

    const stopped = render(<ResultCard results={[result("c", { status: "cancelled", output: undefined })]} prompt="x" onAction={() => {}} />);
    await expect.element(stopped.getByText("Stopped")).toBeVisible();
  });

  it("keeps a stopped stream's partial text", async () => {
    const screen = render(
      <ResultCard results={[result("t", { status: "cancelled", output: { src: "Once upon a", kind: "text" } })]} prompt="x" onAction={() => {}} />
    );
    await expect.element(screen.getByText("Once upon a")).toBeVisible();
  });
});
