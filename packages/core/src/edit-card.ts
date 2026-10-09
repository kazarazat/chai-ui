/**
 * The EditCard's geometry, the same in every framework binding: region
 * boxes, zoom and pan, where the instruction field goes, and the card's
 * width. Boxes are fractions of the image (0 to 1); pan and sizes are px.
 */
import { uniqueId } from "./unique-id.js";
import { regionColor, type EditRegion, type RegionBox } from "./region-edit.js";

export const EDIT_ZOOM_STEPS = [1, 1.25, 1.5, 2, 3, 4];
const MIN_SIZE = 0.03;
const KEY_STEP = 0.01;
const KEY_STEP_LARGE = 0.05;
/** The instruction field's width, and a typical height (title row and a two-line field), for placing it. */
const POPOVER_WIDTH = 220;
const POPOVER_HEIGHT = 96;

export type RegionCorner = "nw" | "ne" | "sw" | "se";
export const REGION_CORNERS: RegionCorner[] = ["nw", "ne", "sw", "se"];
export interface Size {
  width: number;
  height: number;
}
export interface Pan {
  x: number;
  y: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Keeps a box inside the image and at least the minimum size. */
export function fitBox(box: RegionBox): RegionBox {
  const width = clamp(box.width, MIN_SIZE, 1);
  const height = clamp(box.height, MIN_SIZE, 1);
  return { x: clamp(box.x, 0, 1 - width), y: clamp(box.y, 0, 1 - height), width, height };
}

/** A box resized by dragging one corner; the opposite corner stays put. */
export function resizeBox(box: RegionBox, corner: RegionCorner, dx: number, dy: number): RegionBox {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.width;
  let bottom = box.y + box.height;
  if (corner === "nw" || corner === "sw") left = clamp(left + dx, 0, right - MIN_SIZE);
  else right = clamp(right + dx, left + MIN_SIZE, 1);
  if (corner === "nw" || corner === "ne") top = clamp(top + dy, 0, bottom - MIN_SIZE);
  else bottom = clamp(bottom + dy, top + MIN_SIZE, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** A region's box after a key: arrows move it (Shift resizes, Alt takes bigger steps). `null` for any other key. */
export function regionBoxForKey(box: RegionBox, key: string, { shift = false, alt = false } = {}): RegionBox | null {
  const step = alt ? KEY_STEP_LARGE : KEY_STEP;
  const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[key];
  if (!delta) return null;
  const [dx, dy] = delta;
  return shift ? resizeBox(box, "se", dx, dy) : fitBox({ ...box, x: box.x + dx, y: box.y + dy });
}

/** Pan limits at a zoom level: the image always covers the viewport. */
export function clampPan(pan: Pan, zoom: number, size: Size): Pan {
  return {
    x: clamp(pan.x, size.width - size.width * zoom, 0),
    y: clamp(pan.y, size.height - size.height * zoom, 0),
  };
}

/** The pan that zooms around the middle of the view, so what's centered stays centered. */
export function panForZoom(pan: Pan, zoom: number, next: number, size: Size): Pan {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const ratio = next / zoom;
  return clampPan({ x: cx - (cx - pan.x) * ratio, y: cy - (cy - pan.y) * ratio }, next, size);
}

/** The pan after an arrow key on the zoomed image, or `null` for any other key. */
export function panForKey(pan: Pan, key: string, zoom: number, size: Size): Pan | null {
  const step = 40;
  const delta = ({ ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] } as Record<string, [number, number]>)[key];
  return delta ? clampPan({ x: pan.x + delta[0], y: pan.y + delta[1] }, zoom, size) : null;
}

/** The lowest number no current region uses, so freed numbers (and colors) come back first. */
export function freeRegionNumber(regions: EditRegion[]): number {
  let n = 1;
  while (regions.some((r) => r.number === n)) n += 1;
  return n;
}

/** A new region, centered in the part of the image in view, so it's visible when zoomed in. */
export function newRegion(regions: EditRegion[], zoom: number, pan: Pan, size: Size): EditRegion {
  const view = 1 / zoom;
  const centerX = size.width ? -pan.x / (size.width * zoom) + view / 2 : 0.5;
  const centerY = size.height ? -pan.y / (size.height * zoom) + view / 2 : 0.5;
  const box = fitBox({ x: centerX - (0.3 * view) / 2, y: centerY - (0.2 * view) / 2, width: 0.3 * view, height: 0.2 * view });
  return { id: uniqueId(), number: freeRegionNumber(regions), box, prompt: "" };
}

/**
 * Where the instruction field goes: above its region, or below it when
 * there isn't room above and it clears the controls along the bottom edge.
 */
export function regionPopoverPosition(box: RegionBox, zoom: number, pan: Pan, size: Size, paginated: boolean) {
  const left = box.x * size.width * zoom + pan.x;
  const top = box.y * size.height * zoom + pan.y;
  const bottom = (box.y + box.height) * size.height * zoom + pan.y;
  const reserved = paginated ? 100 : 56;
  const fitsBelow = bottom + 8 + POPOVER_HEIGHT <= size.height - reserved;
  const above = top > POPOVER_HEIGHT + 16 || !fitsBelow;
  return {
    left: clamp(left, 8, Math.max(8, size.width - POPOVER_WIDTH - 8)),
    top: above ? Math.max(top - 8, POPOVER_HEIGHT + 8) : bottom + 8,
    above,
  };
}

/**
 * The card's width: from `scale` (of the image's own width), else `width`,
 * else `maxWidth`, then fitted inside `maxWidth` × `maxHeight` keeping the image's shape.
 */
export function editCardWidth(
  natural: Size | null,
  { width, scale, maxWidth, maxHeight }: { width?: number; scale?: number; maxWidth: number; maxHeight: number }
): number {
  const base = scale != null && natural ? natural.width * scale : (width ?? maxWidth);
  const heightCap = natural && natural.height > 0 ? (maxHeight * natural.width) / natural.height : Infinity;
  return Math.round(Math.min(base, maxWidth, heightCap));
}

/** A region's place on the image, as percentages, and its color. */
export function regionBoxStyle(r: EditRegion): Record<string, string> {
  return {
    left: `${r.box.x * 100}%`,
    top: `${r.box.y * 100}%`,
    width: `${r.box.width * 100}%`,
    height: `${r.box.height * 100}%`,
    "--chai-region-color": regionColor(r.number),
  };
}
