/**
 * Region editing: a person marks boxes on an image, each with its own
 * instruction, and the edit model changes only those areas. This file
 * holds the region shape, the models that support it, and the prompt
 * builder that turns regions into what each model reads.
 */

import type { ModelOption, RegionFormat } from "./types.js";

/** A box on an image, as fractions of the image's width and height (0 to 1), so it holds at any display size. */
export interface RegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One marked area of an image and what should change there. */
export interface EditRegion {
  id: string;
  /** Its label and color: "Region 1" uses the first region color. Stays the same when other regions are removed. */
  number: number;
  box: RegionBox;
  prompt: string;
}

/** The region cap when a model doesn't set `maxRegions`. One per region color. */
export const DEFAULT_MAX_REGIONS = 6;

/**
 * Edit models on Fal that take regions with their own instructions. A
 * suggested default list, not a requirement: any `ModelOption` can be
 * offered, and one without `regionFormat` gets its regions in words.
 * Verified against Fal's catalog 2026-10-03.
 */
export const PRECISE_EDIT_MODELS: ModelOption[] = [
  {
    id: "blackforestlabs/flux-3/edit-image",
    label: "Flux 3 Image",
    provider: "Black Forest Labs",
    speed: "standard",
    regionFormat: "flux-3-boxes",
    maxRegions: DEFAULT_MAX_REGIONS,
  },
];

/** The image an edit applies to, as Flux 3 Image names it: the first entry of `image_urls`. */
const SOURCE_IMAGE = "ref_image_0";

function regionId(region: EditRegion): string {
  return `region_${region.number}`;
}

/** Flux 3 Image's box order and scale: [top, left, bottom, right], whole numbers from 0 to 1000. */
function toFluxBox({ x, y, width, height }: RegionBox): [number, number, number, number] {
  const scale = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000);
  return [scale(y), scale(x), scale(y + height), scale(x + width)];
}

function percent(v: number): string {
  return `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
}

/**
 * Builds the prompt for an image edit. With no regions it's the prompt as
 * typed. With regions:
 *
 * - `"flux-3-boxes"`: an instruction naming each region `<region_N>`,
 *   followed by a JSON array with each region's box, the format Flux 3
 *   Image reads from the prompt (it has no separate parameter for boxes).
 * - `"text"` (the default): each region's position described in words, for
 *   models without box support. Placement is less precise.
 *
 * `prompt` is the change across the whole image and may be empty when every
 * region has its own instruction.
 */
export function buildRegionEditPrompt({
  prompt,
  regions,
  format = "text",
}: {
  prompt: string;
  regions: EditRegion[];
  format?: RegionFormat;
}): string {
  const overall = prompt.trim();
  if (regions.length === 0) return overall;

  if (format === "flux-3-boxes") {
    const changes = regions.map((r) => `<${regionId(r)}>: ${r.prompt.trim()}`).join("; ");
    const record = [
      `In <${SOURCE_IMAGE}>, change only the marked regions: ${changes}.`,
      overall && `Across the whole image: ${overall}.`,
      "Keep everything outside the regions exactly as it is.",
    ]
      .filter(Boolean)
      .join(" ");
    const rows = regions.map((r) => {
      const box = toFluxBox(r.box);
      return { id: regionId(r), kind: "anchor", from: SOURCE_IMAGE, src_bbox: box, tgt_bbox: box, desc: r.prompt.trim() };
    });
    return `${record} ${JSON.stringify(rows)}`;
  }

  const changes = regions
    .map(
      (r) =>
        `Region ${r.number} (from ${percent(r.box.x)} to ${percent(r.box.x + r.box.width)} across and ` +
        `${percent(r.box.y)} to ${percent(r.box.y + r.box.height)} down): ${r.prompt.trim()}.`
    )
    .join(" ");
  return [`Edit only these areas of the image. ${changes}`, overall && `Across the whole image: ${overall}.`, "Keep everything else unchanged."]
    .filter(Boolean)
    .join(" ");
}
