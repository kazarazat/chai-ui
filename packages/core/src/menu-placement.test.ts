import { describe, expect, it } from "vitest";
import { menuOpensAbove } from "./menu-placement.js";

describe("menuOpensAbove", () => {
  const vh = 800;
  it("follows an explicit placement", () => {
    expect(menuOpensAbove("above", { top: 700, bottom: 740 }, 300, vh)).toBe(true);
    expect(menuOpensAbove("below", { top: 10, bottom: 50 }, 300, vh)).toBe(false);
  });

  it("opens below when it fits there, above when only that fits", () => {
    // A bar near the top of the screen (the page scrolled down): below.
    expect(menuOpensAbove("auto", { top: 60, bottom: 100 }, 330, vh)).toBe(false);
    // A bar docked to the bottom: above.
    expect(menuOpensAbove("auto", { top: 700, bottom: 740 }, 330, vh)).toBe(true);
  });

  it("opens toward the side with more room when neither fits", () => {
    expect(menuOpensAbove("auto", { top: 500, bottom: 540 }, 600, vh)).toBe(true);
    expect(menuOpensAbove("auto", { top: 200, bottom: 240 }, 600, vh)).toBe(false);
  });
});
