import { createComponent } from "@lit/react";
import * as React from "react";
import { MdSwitch } from "@material/web/switch/switch.js";
import type { PrimitiveProps } from "@chai-ui/core";

/**
 * `<md-switch>` is a Lit web component: its `selected` state is a JS
 * property (not an HTML attribute) and it reports changes via a native
 * `change` event, not a React synthetic one. Plain JSX on a custom-element
 * tag can't bind either correctly — React would try to set `selected` as a
 * string attribute and would never see the DOM `change` event as an
 * `onChange` prop. `@lit/react`'s `createComponent` does that
 * property/attribute distinction and event-listener wiring once, here, so
 * this stays a plain function component with no local state, refs, or
 * effects of its own.
 */
const MdSwitchElement = createComponent({
  react: React,
  tagName: "md-switch",
  elementClass: MdSwitch,
  events: {
    onChange: "change",
  },
});

export interface ToggleProps extends PrimitiveProps<boolean> {
  /** The switch's accessible name, e.g. "Auto-select model". Required unless something else labels it. */
  ariaLabel?: string;
}

/** MD3 adapter (§12.2, Adapter) for the CHAI primitive contract — wraps `<md-switch>`. `chai-switch` is the hook `style.css` uses to color every switch from Chai tokens — see that rule's own comment. */
export function Toggle({ value, onChange, disabled, ariaLabel }: ToggleProps) {
  return (
    <MdSwitchElement
      className="chai-switch"
      aria-label={ariaLabel}
      selected={value}
      disabled={disabled}
      showOnlySelectedIcon
      onChange={(e) => onChange((e.target as MdSwitch).selected)}
    />
  );
}
