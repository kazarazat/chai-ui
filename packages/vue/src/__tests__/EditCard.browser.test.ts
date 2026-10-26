import EditCard from "../EditCard.vue";
import { editCardContract, type EditCardProps } from "../../../shared/contracts/edit-card.contract.js";
import { renderWith } from "./render.js";

editCardContract(
  renderWith(EditCard, ({ onActiveVersionChange, onRegionsChange, ...props }: EditCardProps) => ({
    ...props,
    "onUpdate:activeVersion": onActiveVersionChange,
    "onUpdate:regions": onRegionsChange,
  }))
);
