import Pagination from "../primitives/Pagination.vue";
import { paginationContract, type PaginationProps } from "../../../react/src/__tests__/contracts/pagination.contract.js";
import { renderWith } from "./render.js";

paginationContract(renderWith(Pagination, ({ onChange, ...props }: PaginationProps) => ({ ...props, "onUpdate:index": onChange })));
