/** How many region colors the tokens define (`--chai-color-semantic-region-1` to `-6`). */
const REGION_COLOR_COUNT = 6;

/** The color token for a region number. Numbers past the last color start over at the first. */
export function regionColor(number: number): string {
  return `var(--chai-color-semantic-region-${((Math.max(1, number) - 1) % REGION_COLOR_COUNT) + 1})`;
}
