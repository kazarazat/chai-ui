import ResultCard from "../ResultCard.vue";
import { resultCardContract } from "../../../react/src/__tests__/contracts/result-card.contract.js";
import { renderWith } from "./render.js";

resultCardContract(renderWith(ResultCard));
