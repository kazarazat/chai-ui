import SidePanel from "../SidePanel.vue";
import { sidePanelContract, type SidePanelProps } from "../../../shared/contracts/side-panel.contract.js";
import { renderWith } from "./render.js";

/** React's `onOpenChange` is Vue's `v-model:open` event. */
sidePanelContract(
  renderWith(SidePanel, ({ onOpenChange, ...props }: SidePanelProps) => ({ ...props, "onUpdate:open": onOpenChange }))
);
