import ResultCard from "../ResultCard.vue";
import { resultCardContract } from "../../../shared/contracts/result-card.contract.js";
import { renderWith } from "./render.js";

resultCardContract(renderWith(ResultCard));
