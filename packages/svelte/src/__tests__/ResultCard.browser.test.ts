import ResultCard from "../ResultCard.svelte";
import { resultCardContract } from "../../../react/src/__tests__/contracts/result-card.contract.js";
import { renderWith } from "./render.js";

resultCardContract(renderWith(ResultCard));
