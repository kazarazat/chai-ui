import Pagination from "../primitives/Pagination.svelte";
import { paginationContract } from "../../../shared/contracts/pagination.contract.js";
import { renderWith } from "./render.js";

paginationContract(renderWith(Pagination));
