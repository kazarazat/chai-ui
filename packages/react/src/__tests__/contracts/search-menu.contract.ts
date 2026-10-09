import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import type { Render } from "./render.js";

export interface SearchMenuProps {
  options?: { id: string; label: string }[];
  sections?: { label: string; options: { id: string; label: string }[] }[];
  toggleHeader?: { label: string; value: boolean; onChange: (next: boolean) => void };
  multiple?: boolean;
  value: string | string[] | null;
  triggerLabel: string;
  menuLabel: string;
  onSelect: (option: { id: string; label: string }) => void;
}

const options = [
  { id: "a", label: "Apple" },
  { id: "b", label: "Banana" },
];

export function searchMenuContract(render: Render<SearchMenuProps>) {
  describe("SearchMenu", () => {
    it("filters by search, selects, and reopens with the search cleared", async () => {
      const onSelect = vi.fn();
      const screen = render({ options, value: null, triggerLabel: "Pick fruit", menuLabel: "Fruit", onSelect });
      await screen.getByText("Pick fruit").click();
      // The Material text field labels both its host and its inner <input>; type into the input.
      await userEvent.fill(screen.getByPlaceholder("Input").last(), "ban");
      await expect.element(screen.getByText("Apple")).not.toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      await screen.getByText("Pick fruit").click();
      await expect.element(screen.getByPlaceholder("Input").last()).toHaveValue("");
      await screen.getByText("Apple").click();
      expect(onSelect).toHaveBeenCalledWith(options[0]);
    });

    it("says when nothing matches, and closes from its trigger", async () => {
      const screen = render({ options, value: null, triggerLabel: "Pick fruit", menuLabel: "Fruit", onSelect: () => {} });
      await screen.getByText("Pick fruit").click();
      await userEvent.fill(screen.getByPlaceholder("Input").last(), "kiwi");
      await expect.element(screen.getByText("No matches.")).toBeVisible();
      await screen.getByRole("button", { name: "Pick fruit" }).click();
      await expect.element(screen.getByRole("group", { name: "Fruit" })).not.toBeInTheDocument();
    });

    it("groups options under section headers with a divider between them", async () => {
      const screen = render({
        sections: [
          { label: "Fruit", options },
          { label: "Veg", options: [{ id: "c", label: "Carrot" }] },
        ],
        value: null,
        triggerLabel: "Pick",
        menuLabel: "Food",
        onSelect: () => {},
      });
      await screen.getByText("Pick").click();
      await expect.element(screen.getByRole("list", { name: "Veg" })).toBeInTheDocument();
      expect(document.querySelectorAll(".chai-search-menu__section-label")).toHaveLength(2);
      expect(document.querySelectorAll(".chai-search-menu__divider")).toHaveLength(1);
    });

    it("checks several options with multiple, and disables them while its toggle header is on", async () => {
      const onSelect = vi.fn();
      const props = { options, value: ["a"], multiple: true, triggerLabel: "Pick", menuLabel: "Fruit", onSelect };
      const screen = render(props);
      await screen.getByText("Pick").click();
      await screen.getByRole("button", { name: "Banana" }).click();
      expect(onSelect).toHaveBeenCalledWith(options[1]);
      // The panel stays open for more picks; each row shows a checkbox.
      expect(document.querySelectorAll(".chai-search-menu__checkbox")).toHaveLength(2);
      await expect.element(screen.getByRole("button", { name: "Apple", pressed: true })).toBeInTheDocument();

      await screen.rerender({ ...props, toggleHeader: { label: "Auto-select model", value: true, onChange: () => {} } });
      await expect.element(screen.getByRole("button", { name: "Apple" })).toBeDisabled();
      await expect.poll(() => (document.querySelector(".chai-search-menu__checkbox") as HTMLInputElement).disabled).toBe(true);
    });

    it("shifts its panel left to stay on screen near the right edge", async () => {
      const screen = render({ options, value: null, triggerLabel: "Pick", menuLabel: "Fruit", onSelect: () => {} });
      screen.container.style.cssText = "display: flex; justify-content: flex-end";
      await screen.getByText("Pick").click();
      const panel = document.querySelector<HTMLElement>(".chai-search-menu__panel")!;
      expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(document.documentElement.clientWidth - 16);
    });
  });
}
