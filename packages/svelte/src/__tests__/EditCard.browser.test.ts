import EditCard from "../EditCard.svelte";
import { editCardContract } from "../../../react/src/__tests__/contracts/edit-card.contract.js";
import { renderWith } from "./render.js";

editCardContract(renderWith(EditCard));
