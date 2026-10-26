import EditCard from "../EditCard.svelte";
import { editCardContract } from "../../../shared/contracts/edit-card.contract.js";
import { renderWith } from "./render.js";

editCardContract(renderWith(EditCard));
