import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import { SearchMenu } from "../primitives/SearchMenu.js";

const options = [
  { id: "a", label: "Apple" },
  { id: "b", label: "Banana" },
];

describe("SearchMenu", () => {
  it("filters by search, selects, and reopens with the search cleared", async () => {
    const onSelect = vi.fn();
    const screen = render(
      <SearchMenu options={options} value={null} triggerLabel="Pick fruit" menuLabel="Fruit" onSelect={onSelect} />
    );
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

  it("shifts its panel left to stay on screen near the right edge", async () => {
    const screen = render(
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SearchMenu options={options} value={null} triggerLabel="Pick" menuLabel="Fruit" onSelect={() => {}} />
      </div>
    );
    await screen.getByText("Pick").click();
    const panel = document.querySelector<HTMLElement>(".chai-search-menu__panel")!;
    expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(document.documentElement.clientWidth - 16);
  });
});
