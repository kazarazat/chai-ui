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

/**
 * Renders with controlled props the way a parent would hold them: each
 * callback named in `binds` (e.g. `onAttachmentsChange: "attachments"`)
 * also stores its value and re-renders. A test's own callback still runs.
 * `rerender` takes the props to change.
 */
export function controlled<P extends object>(render: Render<P>, initial: P, binds: Partial<Record<keyof P, keyof P>>) {
  let current = initial;
  const wire = (props: P): P => {
    const wired = { ...props } as Record<string, unknown>;
    for (const [callback, key] of Object.entries(binds) as [string, string][]) {
      const own = (props as Record<string, unknown>)[callback] as ((value: unknown) => void) | undefined;
      wired[callback] = (value: unknown) => {
        own?.(value);
        current = { ...current, [key]: value };
        screen.rerender(wire(current));
      };
    }
    return wired as P;
  };
  const screen = render(wire(current));
  return {
    ...screen,
    rerender: (changes: Partial<P>) => {
      current = { ...current, ...changes };
      return screen.rerender(wire(current));
    },
  };
}
