/**
 * Shared component tests ("contracts"): each one is written once against a
 * `render(props)` that the React and Vue packages each supply, so both
 * bindings are held to the same behavior. Props are React-shaped
 * (`onAction`); the Vue side passes them through as event listeners or maps them.
 */
import type { LocatorSelectors } from "@vitest/browser/context";

export type Rendered<P> = LocatorSelectors & {
  container: HTMLElement;
  unmount(): void;
  rerender(props: P): unknown;
};

export type Render<P> = (props: P) => Rendered<P>;
