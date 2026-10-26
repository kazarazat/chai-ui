import ResultCard from "../ResultCard.svelte";
import { resultCardContract } from "../../../shared/contracts/result-card.contract.js";
import { renderWith } from "./render.js";

resultCardContract(renderWith(ResultCard));
