import { render } from "vitest-browser-react";
import { Composer, type ComposerProps as Props } from "../Composer.js";
import { composerContract, type ComposerProps } from "./contracts/composer.contract.js";

composerContract((props: ComposerProps) => {
  const screen = render(<Composer {...(props as Props)} />);
  return { ...screen, rerender: (next: ComposerProps) => screen.rerender(<Composer {...(next as Props)} />) };
});
