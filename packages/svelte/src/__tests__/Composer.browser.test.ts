import Composer from "../Composer.svelte";
import { composerContract, type ComposerProps } from "../../../react/src/__tests__/contracts/composer.contract.js";
import { renderWith } from "./render.js";

/** React's `className` and style object are Svelte's `class` and style string; every other prop is the same. */
const toSvelte = ({ className, style, ...props }: ComposerProps & { className?: string; style?: Record<string, string> }) => ({
  ...props,
  class: className,
  style: style && Object.entries(style).map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value}`).join("; "),
});

composerContract(renderWith(Composer, toSvelte));
