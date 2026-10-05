import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import { Pagination } from "../primitives/Pagination.js";

function Harness({ onChange }: { onChange?: (i: number) => void }) {
  const [index, setIndex] = useState(0);
  return (
    <Pagination
      count={4}
      index={index}
      label="Results"
      onChange={(i) => {
        setIndex(i);
        onChange?.(i);
      }}
    />
  );
}

describe("Pagination", () => {
  it("is one slider that names the current page", async () => {
    const screen = render(<Harness />);
    const slider = screen.getByRole("slider", { name: "Results" });
    await expect.element(slider).toHaveAttribute("aria-valuetext", "Result 1 of 4");
    expect(screen.container.querySelectorAll("button")).toHaveLength(0);
  });

  it("picks the dot nearest a click", async () => {
    const onChange = vi.fn();
    const screen = render(<Harness onChange={onChange} />);
    // Four 16px dots: x 40 is in the third.
    await screen.getByRole("slider").click({ position: { x: 40, y: 12 } });
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it("moves with arrow keys, Home and End, and stops at the ends", async () => {
    const screen = render(<Harness />);
    const slider = screen.getByRole("slider");
    await userEvent.click(slider);
    await userEvent.keyboard("{Home}{ArrowRight}");
    await expect.element(slider).toHaveAttribute("aria-valuenow", "2");
    await userEvent.keyboard("{End}{ArrowRight}");
    await expect.element(slider).toHaveAttribute("aria-valuenow", "4");
    await userEvent.keyboard("{Home}{ArrowLeft}");
    await expect.element(slider).toHaveAttribute("aria-valuenow", "1");
  });

  it("ignores input when disabled", async () => {
    const onChange = vi.fn();
    const screen = render(<Pagination count={3} index={0} label="Results" onChange={onChange} disabled />);
    await screen.getByRole("slider").click({ position: { x: 40, y: 12 }, force: true });
    expect(onChange).not.toHaveBeenCalled();
    await expect.element(screen.getByRole("slider")).toHaveAttribute("tabindex", "-1");
  });
});
