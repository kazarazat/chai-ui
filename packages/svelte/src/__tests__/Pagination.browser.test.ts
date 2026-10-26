import Pagination from "../primitives/Pagination.svelte";
import { paginationContract } from "../../../react/src/__tests__/contracts/pagination.contract.js";
import { renderWith } from "./render.js";

paginationContract(renderWith(Pagination));
