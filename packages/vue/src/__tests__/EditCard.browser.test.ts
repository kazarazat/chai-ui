import EditCard from "../EditCard.vue";
import { editCardContract, type EditCardProps } from "../../../react/src/__tests__/contracts/edit-card.contract.js";
import { renderWith } from "./render.js";

editCardContract(
  renderWith(EditCard, ({ onActiveVersionChange, onRegionsChange, ...props }: EditCardProps) => ({
    ...props,
    "onUpdate:activeVersion": onActiveVersionChange,
    "onUpdate:regions": onRegionsChange,
  }))
);
