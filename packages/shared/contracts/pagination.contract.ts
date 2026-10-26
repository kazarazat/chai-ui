import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import type { Render } from "./render.js";

export interface PaginationProps {
  count: number;
  index: number;
  label: string;
  onChange: (index: number) => void;
  disabled?: boolean;
}

export function paginationContract(render: Render<PaginationProps>) {
  /** A pager that moves when asked, like a real parent would. */
  function harness(onChange?: (i: number) => void) {
    const props: PaginationProps = {
      count: 4,
      index: 0,
      label: "Results",
      onChange: (i) => {
        onChange?.(i);
        screen.rerender({ ...props, index: i });
      },
    };
    const screen = render(props);
    return screen;
  }

  describe("Pagination", () => {
    it("is one slider that names the current page", async () => {
      const screen = harness();
      const slider = screen.getByRole("slider", { name: "Results" });
      await expect.element(slider).toHaveAttribute("aria-valuetext", "Result 1 of 4");
      expect(screen.container.querySelectorAll("button")).toHaveLength(0);
    });

    it("picks the dot nearest a click", async () => {
      const onChange = vi.fn();
      const screen = harness(onChange);
      // Four 16px dots: x 40 is in the third.
      await screen.getByRole("slider").click({ position: { x: 40, y: 12 } });
      expect(onChange).toHaveBeenLastCalledWith(2);
    });

    it("moves with arrow keys, Home and End, and stops at the ends", async () => {
      const screen = harness();
      const slider = screen.getByRole("slider");
      await userEvent.click(slider);
      await userEvent.keyboard("{Home}{ArrowRight}");
      await expect.element(slider).toHaveAttribute("aria-valuenow", "2");
      await userEvent.keyboard("{End}{ArrowRight}");
      await expect.element(slider).toHaveAttribute("aria-valuenow", "4");
      await userEvent.keyboard("{Home}{ArrowLeft}");
      await expect.element(slider).toHaveAttribute("aria-valuenow", "1");
      // Other keys leave it alone.
      await userEvent.keyboard("a");
      await expect.element(slider).toHaveAttribute("aria-valuenow", "1");
    });

    it("ignores input when disabled", async () => {
      const onChange = vi.fn();
      const screen = render({ count: 3, index: 0, label: "Results", onChange, disabled: true });
      await screen.getByRole("slider").click({ position: { x: 40, y: 12 }, force: true });
      expect(onChange).not.toHaveBeenCalled();
      await expect.element(screen.getByRole("slider")).toHaveAttribute("tabindex", "-1");
    });
  });
}
