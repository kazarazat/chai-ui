import { describe, expect, it } from "vitest";
import { createRawSnippet } from "svelte";
import SidePanel from "../SidePanel.svelte";
import { sidePanelContract } from "../../../shared/contracts/side-panel.contract.js";
import { renderWith } from "./render.js";

sidePanelContract(renderWith(SidePanel));

describe("SidePanel logo", () => {
  it("shows the logo snippet as given, without the default tile, in the launcher and the greeting", async () => {
    const logo = createRawSnippet(() => ({ render: () => '<img alt="Northwind" src="data:," />' }));
    const screen = renderWith(SidePanel)({ title: "Assistant", logo });
    expect(screen.getByAltText("Northwind").elements()).toHaveLength(1);
    await screen.getByRole("button", { name: "Open Assistant" }).click();
    await expect.element(screen.getByAltText("Northwind")).toBeInTheDocument();
    expect(document.querySelector(".chai-side-panel__logo--default")).toBeNull();
    screen.unmount();
  });
});
