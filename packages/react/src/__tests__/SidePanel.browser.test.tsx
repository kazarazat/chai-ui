import { render } from "vitest-browser-react";
import { SidePanel, type SidePanelProps as Props } from "../SidePanel.js";
import { sidePanelContract, type SidePanelProps } from "../../../shared/contracts/side-panel.contract.js";

sidePanelContract((props: SidePanelProps) => {
  const screen = render(<SidePanel {...(props as Props)} />);
  return { ...screen, rerender: (next: SidePanelProps) => screen.rerender(<SidePanel {...(next as Props)} />) };
});
