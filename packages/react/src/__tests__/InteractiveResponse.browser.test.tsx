import { render } from "vitest-browser-react";
import { InteractiveResponse } from "../InteractiveResponse.js";
import {
  interactiveResponseContract,
  type InteractiveResponseProps,
} from "../../../shared/contracts/interactive-response.contract.js";

interactiveResponseContract((props: InteractiveResponseProps) => {
  const screen = render(<InteractiveResponse {...props} />);
  return { ...screen, rerender: (next: InteractiveResponseProps) => screen.rerender(<InteractiveResponse {...next} />) };
});
