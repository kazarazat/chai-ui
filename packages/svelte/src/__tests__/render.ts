import { render as mount } from "vitest-browser-svelte";
import type { Component } from "svelte";
import type { Render } from "../../../react/src/__tests__/contracts/render.js";

/**
 * A contract's `render` for a Svelte component. The props are React's, which
 * Svelte uses as they are; `mapProps` converts the few it spells differently
 * (`className` is `class`). Svelte's `rerender` merges into the current props,
 * so a prop left out of the next set is cleared, as React's would be: a
 * contract that drops `onEnhance` expects the Enhance button to go.
 */
export function renderWith<P extends object>(component: Component<any>, mapProps: (props: P) => object = (p) => p): Render<P> {
  return (props) => {
    let current = mapProps(props) as Record<string, unknown>;
    const screen = mount(component, { props: current as never });
    return {
      ...screen,
      rerender: (next: P) => {
        const cleared = Object.fromEntries(Object.keys(current).map((key) => [key, undefined]));
        current = mapProps(next) as Record<string, unknown>;
        return screen.rerender({ ...cleared, ...current } as never);
      },
    };
  };
}
