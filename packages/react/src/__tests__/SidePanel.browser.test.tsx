import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { SidePanel, type SidePanelProps as Props } from "../SidePanel.js";
import { sidePanelContract, type SidePanelProps } from "../../../shared/contracts/side-panel.contract.js";

sidePanelContract((props: SidePanelProps) => {
  const screen = render(<SidePanel {...(props as Props)} />);
  return { ...screen, rerender: (next: SidePanelProps) => screen.rerender(<SidePanel {...(next as Props)} />) };
});

describe("SidePanel logo", () => {
  it("shows the builder's logo as given, without the default tile, in the launcher and the greeting", async () => {
    const screen = render(<SidePanel title="Assistant" logo={<img alt="Northwind" src="data:," />} />);
    await expect.element(screen.getByRole("button", { name: "Open Assistant" })).toContainElement(screen.getByAltText("Northwind").element() as HTMLElement);
    await screen.getByRole("button", { name: "Open Assistant" }).click();
    await expect.element(screen.getByAltText("Northwind")).toBeInTheDocument();
    expect(document.querySelector(".chai-side-panel__logo--default")).toBeNull();
    screen.unmount();
  });
});
