import { render as mount } from "vitest-browser-vue";
import type { Component } from "vue";
import type { Render } from "../../../react/src/__tests__/contracts/render.js";

/**
 * A contract's `render` for a Vue component. React-shaped props pass
 * straight through: an `onAction` prop is the `action` event's listener.
 * `mapProps` renames the ones Vue spells differently (e.g. `onChange` → `onUpdate:index`).
 */
export function renderWith<P extends object>(component: Component, mapProps: (props: P) => object = (p) => p): Render<P> {
  return (props) => {
    const screen = mount(component, { props: mapProps(props) as never });
    return { ...screen, rerender: (next: P) => screen.rerender(mapProps(next) as never) };
  };
}
