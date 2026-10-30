import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-vue";
import SidePanel from "../SidePanel.vue";
import { sidePanelContract, type SidePanelProps } from "../../../shared/contracts/side-panel.contract.js";
import { renderWith } from "./render.js";

/** React's `onOpenChange` is Vue's `v-model:open` event. */
sidePanelContract(
  renderWith(SidePanel, ({ onOpenChange, ...props }: SidePanelProps) => ({ ...props, "onUpdate:open": onOpenChange }))
);

describe("SidePanel logo", () => {
  it("shows the #logo slot as given, without the default tile, in the launcher and the greeting", async () => {
    const screen = render(SidePanel, { props: { title: "Assistant" }, slots: { logo: '<img alt="Northwind" src="data:," />' } });
    await expect.element(screen.getByRole("button", { name: "Open Assistant" })).toBeInTheDocument();
    expect(screen.getByAltText("Northwind").elements()).toHaveLength(1);
    await screen.getByRole("button", { name: "Open Assistant" }).click();
    await expect.element(screen.getByAltText("Northwind")).toBeInTheDocument();
    expect(document.querySelector(".chai-side-panel__logo--default")).toBeNull();
    screen.unmount();
  });
});
