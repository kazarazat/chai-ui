import { render } from "vitest-browser-react";
import { SearchMenu } from "../primitives/SearchMenu.js";
import { searchMenuContract, type SearchMenuProps } from "./contracts/search-menu.contract.js";

searchMenuContract((props: SearchMenuProps) => {
  const screen = render(<SearchMenu {...props} />);
  return { ...screen, rerender: (next: SearchMenuProps) => screen.rerender(<SearchMenu {...next} />) };
});
