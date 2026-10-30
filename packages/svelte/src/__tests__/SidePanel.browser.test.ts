import SidePanel from "../SidePanel.svelte";
import { sidePanelContract } from "../../../shared/contracts/side-panel.contract.js";
import { renderWith } from "./render.js";

sidePanelContract(renderWith(SidePanel));
