import InteractiveResponse from "../InteractiveResponse.vue";
import { interactiveResponseContract } from "../../../shared/contracts/interactive-response.contract.js";
import { renderWith } from "./render.js";

interactiveResponseContract(renderWith(InteractiveResponse));
