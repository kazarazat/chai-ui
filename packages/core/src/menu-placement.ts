/**
 * Which way a component's menus open from their trigger. `"above"` suits a
 * bar docked to the bottom of the screen and `"below"` one docked to the
 * top; `"auto"` measures at open time, for a bar that sits in the page.
 */
export type MenuPlacement = "auto" | "above" | "below";

/** The gap between a trigger and its open menu, and the least room kept to the screen's edge. */
const GAP = 8;
const EDGE = 16;

/**
 * Whether a menu opens above its trigger. `"auto"` opens below when the menu
 * fits there, above when only that side fits, and otherwise toward the side
 * with more room, so it's never cut off when it could have fit.
 */
export function menuOpensAbove(
  placement: MenuPlacement,
  trigger: { top: number; bottom: number },
  menuHeight: number,
  viewportHeight: number
): boolean {
  if (placement !== "auto") return placement === "above";
  const roomBelow = viewportHeight - EDGE - (trigger.bottom + GAP);
  const roomAbove = trigger.top - GAP - EDGE;
  if (menuHeight <= roomBelow) return false;
  if (menuHeight <= roomAbove) return true;
  return roomAbove > roomBelow;
}
