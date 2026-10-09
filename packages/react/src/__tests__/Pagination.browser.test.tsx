import { render } from "vitest-browser-react";
import { Pagination } from "../primitives/Pagination.js";
import { paginationContract, type PaginationProps } from "./contracts/pagination.contract.js";

paginationContract((props: PaginationProps) => {
  const screen = render(<Pagination {...props} />);
  return { ...screen, rerender: (next: PaginationProps) => screen.rerender(<Pagination {...next} />) };
});
