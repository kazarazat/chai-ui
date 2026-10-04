import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { DEFAULT_MAX_REGIONS, type EditRegion, type RegionBox, type ResultStatus } from "@chai-ui/core";
import { Pagination } from "./primitives/Pagination.js";
import {
  AddIcon,
  CheckSymbolIcon,
  CloseSymbolIcon,
  DeleteIcon,
  DownloadIcon,
  ExpandIcon,
  ShareIcon,
  VisibilityIcon,
  VisibilityOffIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons.js";
import { downloadFilename, downloadMedia, shareMedia } from "./media-actions.js";
import { PageSlide, usePageSlide } from "./page-slide.js";
import { regionColor } from "./regions.js";

/**
 * One version of the image being edited: the original, or the result of an
 * edit. `useComposer`'s `edit.versions` builds these from its runs.
 */
export interface EditVersion {
  id: string;
  /** The image, once there is one. */
  src?: string;
  /** The image this version was edited from, shown under the progress spinner until `src` arrives. */
  from?: string;
  status: ResultStatus;
  /** The regions this version was made with (none for the original). Shown faintly, for reference. */
  regions: EditRegion[];
  error?: string;
}

export interface EditCardProps {
  /** The original image first, then each edit. Paged with the dots under the card. */
  versions: EditVersion[];
  activeVersion: number;
  onActiveVersionChange: (index: number) => void;
  /** The new regions on the image, each committed with its instruction. Controlled: share them with `Composer`'s `regions`. */
  regions: EditRegion[];
  onRegionsChange: (next: EditRegion[]) => void;
  /** The most regions the chosen model takes (`ModelOption.maxRegions`). "New region" is disabled at this many. Defaults to 6. */
  maxRegions?: number;
  /** Width in px. Defaults to 421. The height follows the image. */
  width?: number;
  /** Alt text for the image. Defaults to "Image being edited". */
  alt?: string;
  /** Fires after the card downloads or shares the version showing. */
  onAction?: (action: "download" | "share", version: EditVersion) => void;
  disabled?: boolean;
}

const ZOOM_STEPS = [1, 1.25, 1.5, 2, 3, 4];
const MIN_SIZE = 0.03;
const KEY_STEP = 0.01;
const KEY_STEP_LARGE = 0.05;

type Size = { width: number; height: number };
type Pan = { x: number; y: number };
type Drag =
  | { kind: "move" | "nw" | "ne" | "sw" | "se"; id: string; x: number; y: number; box: RegionBox; moved: boolean }
  | { kind: "pan"; x: number; y: number; pan: Pan; moved: boolean };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Keeps a box inside the image and at least the minimum size. */
function fitBox(box: RegionBox): RegionBox {
  const width = clamp(box.width, MIN_SIZE, 1);
  const height = clamp(box.height, MIN_SIZE, 1);
  return { x: clamp(box.x, 0, 1 - width), y: clamp(box.y, 0, 1 - height), width, height };
}

/** A box resized by dragging one corner; the opposite corner stays put. */
function resizeBox(box: RegionBox, corner: "nw" | "ne" | "sw" | "se", dx: number, dy: number): RegionBox {
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

/** Pan limits at a zoom level: the image always covers the viewport. */
function clampPan(pan: Pan, zoom: number, size: Size): Pan {
  return {
    x: clamp(pan.x, size.width - size.width * zoom, 0),
    y: clamp(pan.y, size.height - size.height * zoom, 0),
  };
}

function nextRegionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `region-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** The lowest number no current region uses, so freed numbers (and colors) come back first. */
function freeNumber(regions: EditRegion[]): number {
  let n = 1;
  while (regions.some((r) => r.number === n)) n += 1;
  return n;
}

/**
 * The image editing card: the person marks regions on the image, gives each
 * one an instruction, and checks it into the Composer. It shares
 * `ResultCard`'s frame, with region actions where the votes would be.
 *
 * Drop it in with `useComposer`'s `edit`: `{edit && <EditCard {...edit} />}`.
 * Its regions are shared with `Composer` (pass `edit.regions` and
 * `edit.onRegionsChange` there too), and each edit's result comes back here
 * as a new version.
 *
 * - "New region" adds a box with a prompt field. Check adds the region to
 *   the Composer; trash removes it. Clicking a region reopens its field.
 * - Drag a region to move it, or a corner to resize it. By keyboard:
 *   arrows move the selected region, Shift + arrows resize it.
 * - Zoom keeps the image inside the card; drag (or arrow keys) to pan.
 */
export function EditCard({
  versions,
  activeVersion,
  onActiveVersionChange,
  regions,
  onRegionsChange,
  maxRegions = DEFAULT_MAX_REGIONS,
  width,
  alt = "Image being edited",
  onAction,
  disabled = false,
}: EditCardProps) {
  const index = clamp(activeVersion, 0, Math.max(0, versions.length - 1));
  const version = versions[index];
  const ready = version?.status === "done" && Boolean(version.src);

  // A region being drawn, not yet checked into the Composer.
  const [draft, setDraft] = useState<EditRegion | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [hidden, setHidden] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [expanded, setExpanded] = useState(false);
  const drag = useRef<Drag | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Paging slides between versions, and a different version starts clean:
  // no half-drawn region, no zoom.
  const { slide, endSlide } = usePageSlide(version?.id, index, version?.src ?? version?.from);
  const [cleanFor, setCleanFor] = useState(version?.id);
  if (version?.id !== cleanFor) {
    setCleanFor(version?.id);
    setDraft(null);
    setSelectedId(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A region being drawn takes a free number, even if the regions changed
  // since it was started (so checking it in can't duplicate a number).
  const shownDraft =
    draft && regions.some((r) => r.number === draft.number) ? { ...draft, number: freeNumber(regions) } : draft;
  const all = shownDraft ? [...regions, shownDraft] : regions;
  const selected = all.find((r) => r.id === selectedId) ?? null;
  const isDraft = selected != null && selected.id === draft?.id;
  const canCheck = selected != null && text.trim().length > 0 && (isDraft || text.trim() !== selected.prompt);
  const atCap = all.length >= maxRegions;
  const anyRegions = all.length > 0 || (version?.regions.length ?? 0) > 0;

  // The field opens focused, so a new region can be described straight away.
  useEffect(() => {
    if (selectedId) fieldRef.current?.focus();
  }, [selectedId]);

  // The field grows with its text instead of scrolling it out of view.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, selectedId]);

  function select(region: EditRegion | null) {
    setSelectedId(region?.id ?? null);
    setText(region?.prompt ?? "");
  }

  function setBox(id: string, box: RegionBox) {
    if (draft?.id === id) setDraft({ ...draft, box });
    else onRegionsChange(regions.map((r) => (r.id === id ? { ...r, box } : r)));
  }

  function addRegion() {
    // Centered in the part of the image in view, so it's visible when zoomed in.
    const viewW = 1 / zoom;
    const viewH = 1 / zoom;
    const centerX = size.width ? (-pan.x / (size.width * zoom)) + viewW / 2 : 0.5;
    const centerY = size.height ? (-pan.y / (size.height * zoom)) + viewH / 2 : 0.5;
    const box = fitBox({ x: centerX - (0.3 * viewW) / 2, y: centerY - (0.2 * viewH) / 2, width: 0.3 * viewW, height: 0.2 * viewH });
    const region: EditRegion = { id: nextRegionId(), number: freeNumber(regions), box, prompt: "" };
    setDraft(region);
    setHidden(false);
    select(region);
  }

  function check() {
    if (!selected || !canCheck) return;
    const prompt = text.trim();
    if (isDraft) {
      onRegionsChange([...regions, { ...selected, prompt }]);
      setDraft(null);
    } else {
      onRegionsChange(regions.map((r) => (r.id === selected.id ? { ...r, prompt } : r)));
    }
    select(null);
  }

  function remove() {
    if (!selected) return;
    if (isDraft) setDraft(null);
    else onRegionsChange(regions.filter((r) => r.id !== selected.id));
    select(null);
  }

  function clearAll() {
    setDraft(null);
    select(null);
    onRegionsChange([]);
  }

  function zoomTo(next: number) {
    // Zooms around the middle of the view, so what's centered stays centered.
    const cx = size.width / 2;
    const cy = size.height / 2;
    const ratio = next / zoom;
    setPan(clampPan({ x: cx - (cx - pan.x) * ratio, y: cy - (cy - pan.y) * ratio }, next, size));
    setZoom(next);
  }
  const zoomIndex = ZOOM_STEPS.indexOf(zoom);

  // --- Pointer: move and resize regions, pan the zoomed image ---
  // Moves and releases bubble to the viewport, even while a region or
  // handle holds the pointer capture, so the viewport handles them all.

  function startRegionDrag(e: PointerEvent, region: EditRegion, kind: DragKind) {
    if (disabled || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind, id: region.id, x: e.clientX, y: e.clientY, box: region.box, moved: false };
    if (region.id !== selectedId) select(region);
  }

  function startPan(e: PointerEvent) {
    if (e.button !== 0) return;
    if (zoom > 1) e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: "pan", x: e.clientX, y: e.clientY, pan, moved: false };
  }

  function handlePointerMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || !size.width) return;
    const dxPx = e.clientX - d.x;
    const dyPx = e.clientY - d.y;
    if (Math.abs(dxPx) + Math.abs(dyPx) > 2) d.moved = true;
    if (d.kind === "pan") {
      if (zoom > 1) setPan(clampPan({ x: d.pan.x + dxPx, y: d.pan.y + dyPx }, zoom, size));
      return;
    }
    const dx = dxPx / (size.width * zoom);
    const dy = dyPx / (size.height * zoom);
    setBox(d.id, d.kind === "move" ? fitBox({ ...d.box, x: d.box.x + dx, y: d.box.y + dy }) : resizeBox(d.box, d.kind, dx, dy));
  }

  function handlePointerUp() {
    const d = drag.current;
    drag.current = null;
    // A click on the image itself (not a drag) closes the open field.
    if (d?.kind === "pan" && !d.moved) select(null);
  }

  // --- Keyboard ---

  function handleRegionKey(e: KeyboardEvent, region: EditRegion) {
    const step = e.altKey ? KEY_STEP_LARGE : KEY_STEP;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = arrows[e.key];
    if (delta) {
      e.preventDefault();
      e.stopPropagation();
      const [dx, dy] = delta;
      setBox(region.id, e.shiftKey ? resizeBox(region.box, "se", dx, dy) : fitBox({ ...region.box, x: region.box.x + dx, y: region.box.y + dy }));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (region.id === draft?.id) setDraft(null);
      else onRegionsChange(regions.filter((r) => r.id !== region.id));
      select(null);
    }
  }

  function handleViewportKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || zoom <= 1) return;
    const step = 40;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const delta = arrows[e.key];
    if (!delta) return;
    e.preventDefault();
    setPan(clampPan({ x: pan.x + delta[0], y: pan.y + delta[1] }, zoom, size));
  }

  function handleFieldKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      check();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (isDraft) setDraft(null);
      select(null);
    }
  }

  // --- Media actions ---

  const handleDownload = async () => {
    if (!version?.src) return;
    await downloadMedia(version.src, downloadFilename(version.id, "image", version.src));
    onAction?.("download", version);
  };

  const handleShare = async () => {
    if (!version?.src) return;
    await shareMedia(version.src);
    onAction?.("share", version);
  };

  // --- Layout ---

  // The field sits above its region, or below it when there isn't room above.
  const popover = selected && !hidden && size.width
    ? (() => {
        const left = selected.box.x * size.width * zoom + pan.x;
        const top = selected.box.y * size.height * zoom + pan.y;
        const bottom = (selected.box.y + selected.box.height) * size.height * zoom + pan.y;
        // Below only when it clears the controls along the image's bottom edge.
        const reserved = versions.length > 1 ? 100 : 56;
        const fitsBelow = bottom + 8 + POPOVER_HEIGHT <= size.height - reserved;
        const above = top > POPOVER_HEIGHT + 16 || !fitsBelow;
        return {
          left: clamp(left, 8, Math.max(8, size.width - POPOVER_WIDTH - 8)),
          top: above ? Math.max(top - 8, POPOVER_HEIGHT + 8) : bottom + 8,
          above,
        };
      })()
    : null;

  if (!version) return null;

  return (
    <>
      <div
        className="chai-edit-card"
        style={width != null ? ({ "--chai-edit-card-width": `${width}px` } as CSSProperties) : undefined}
      >
        <div
          ref={viewportRef}
          className={`chai-edit-card__viewport${zoom > 1 ? " chai-edit-card__viewport--zoomed" : ""}`}
          role="group"
          aria-label={zoom > 1 ? `Image, zoomed to ${Math.round(zoom * 100)}%. Arrow keys move around.` : "Image"}
          tabIndex={zoom > 1 ? 0 : undefined}
          onPointerDown={startPan}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleViewportKey}
        >
          <PageSlide slide={slide} onEnd={endSlide}>
          <div
            className="chai-edit-card__layer"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, "--chai-edit-zoom": zoom } as CSSProperties}
          >
            {version.src || version.from ? (
              <img className="chai-edit-card__image" src={version.src ?? version.from} alt={alt} draggable={false} />
            ) : (
              <div className="chai-edit-card__placeholder" />
            )}

            {!hidden &&
              version.regions.map((r) => (
                <span
                  key={`applied-${r.id}`}
                  className="chai-edit-card__region chai-edit-card__region--applied"
                  style={boxStyle(r)}
                  aria-hidden="true"
                />
              ))}

            {!hidden &&
              ready &&
              all.map((r) => (
                <RegionShape
                  key={r.id}
                  region={r}
                  selected={r.id === selectedId}
                  draft={r.id === draft?.id}
                  disabled={disabled}
                  onDragStart={startRegionDrag}
                  onSelect={select}
                  onKeyDown={handleRegionKey}
                />
              ))}
          </div>
          </PageSlide>

          {version.status !== "done" && (
            <div className="chai-edit-card__status" role="status">
              {version.status === "queued" || version.status === "running" ? (
                <span className="chai-edit-card__spinner" role="img" aria-label="Editing" />
              ) : (
                <p className="chai-edit-card__status-text">
                  {version.status === "cancelled" ? "Stopped" : (version.error ?? "Something went wrong.")}
                </p>
              )}
            </div>
          )}

          {/* Translucent backings keep these readable on any image. */}
          <div className="chai-card-top chai-card-top--start" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="chai-card-top-btn"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={!ready || zoomIndex >= ZOOM_STEPS.length - 1}
              onClick={() => zoomTo(ZOOM_STEPS[zoomIndex + 1]!)}
            >
              <ZoomInIcon />
            </button>
            <span className="chai-edit-card__zoom-level" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="chai-card-top-btn"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={!ready || zoomIndex <= 0}
              onClick={() => zoomTo(ZOOM_STEPS[zoomIndex - 1]!)}
            >
              <ZoomOutIcon />
            </button>
          </div>

          <div className="chai-card-top chai-card-top--end" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="chai-card-top-btn" aria-label="Download" title="Download" disabled={disabled || !ready} onClick={handleDownload}>
              <DownloadIcon />
            </button>
            <button type="button" className="chai-card-top-btn" aria-label="Share" title="Share" disabled={disabled || !ready} onClick={handleShare}>
              <ShareIcon />
            </button>
            <button type="button" className="chai-card-top-btn" aria-label="Expand" title="Expand" disabled={!ready} onClick={() => setExpanded(true)}>
              <ExpandIcon />
            </button>
          </div>

          {/* Over the bottom of the image (it fills the card): the version dots
              once there's an edit, and under them the region actions. Stacked
              in one column so wrapped chips push the dots up, never under. */}
          <div className="chai-card-bottom" onPointerDown={(e) => e.stopPropagation()}>
            {versions.length > 1 && (
              <div className="chai-card-pager">
                <Pagination count={versions.length} index={index} onChange={onActiveVersionChange} label="Versions" itemLabel="Version" disabled={disabled} />
              </div>
            )}
            <div className="chai-card-actions">
              <div className="chai-card-chips">
                <button
                  type="button"
                  className="chai-card-chip"
                  disabled={disabled || !ready || atCap}
                  title={atCap ? `This model takes up to ${maxRegions} regions` : undefined}
                  onClick={addRegion}
                >
                  <AddIcon />
                  New region
                </button>
                <button type="button" className="chai-card-chip" disabled={disabled || all.length === 0} onClick={clearAll}>
                  <CloseSymbolIcon />
                  Clear regions
                </button>
              </div>
              {/* Named, and given a tooltip, by what a press will do. */}
              <button
                type="button"
                className="chai-card-round"
                aria-label={hidden ? "Show regions" : "Hide regions"}
                title={hidden ? "Show regions" : "Hide regions"}
                disabled={!anyRegions}
                onClick={() => {
                  setHidden(!hidden);
                  select(null);
                }}
              >
                {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </button>
            </div>
          </div>

          {popover && selected && (
            <div
              className={`chai-edit-card__popover${popover.above ? " chai-edit-card__popover--above" : ""}`}
              style={{ left: popover.left, top: popover.top }}
              role="dialog"
              aria-label={`Region ${selected.number}`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="chai-edit-card__popover-header">
                <span className="chai-edit-card__popover-title">Region {selected.number}</span>
                <button
                  type="button"
                  className="chai-card-top-btn"
                  aria-label="Add region to prompt"
                  title="Add region to prompt"
                  disabled={disabled || !canCheck}
                  onClick={check}
                >
                  <CheckSymbolIcon />
                </button>
                <button
                  type="button"
                  className="chai-card-top-btn"
                  aria-label="Delete region"
                  title="Delete region"
                  disabled={disabled}
                  onClick={remove}
                >
                  <DeleteIcon />
                </button>
              </div>
              <textarea
                ref={fieldRef}
                className="chai-edit-card__field"
                value={text}
                rows={1}
                placeholder="What should change here?"
                aria-label={`Instruction for region ${selected.number}`}
                disabled={disabled}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleFieldKey}
              />
            </div>
          )}
        </div>

      </div>

      {/* The expanded view reuses the result card's dialog, outside the card for the same reason. */}
      {expanded && version.src && (
        <ExpandedImage src={version.src} alt={alt} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

const POPOVER_WIDTH = 220;
/** A typical height for the instruction panel (title row and a two-line field), for placing it. */
const POPOVER_HEIGHT = 96;

type DragKind = "move" | "nw" | "ne" | "sw" | "se";
const CORNERS = ["nw", "ne", "sw", "se"] as const;

/** One region on the image: a button to select, move or delete it, its number badge, and corner handles while selected. */
function RegionShape({
  region,
  selected,
  draft,
  disabled,
  onDragStart,
  onSelect,
  onKeyDown,
}: {
  region: EditRegion;
  selected: boolean;
  draft: boolean;
  disabled: boolean;
  onDragStart: (e: PointerEvent, region: EditRegion, kind: DragKind) => void;
  onSelect: (region: EditRegion) => void;
  onKeyDown: (e: KeyboardEvent, region: EditRegion) => void;
}) {
  const name = `Region ${region.number}`;
  return (
    <div
      className={`chai-edit-card__region${selected ? " chai-edit-card__region--selected" : ""}${draft ? " chai-edit-card__region--draft" : ""}`}
      style={boxStyle(region)}
    >
      <button
        type="button"
        className="chai-edit-card__region-body"
        aria-label={`${name}${region.prompt ? `: ${region.prompt}` : ", no instruction yet"}. Arrow keys move it, Shift and arrow keys resize it.`}
        aria-pressed={selected}
        disabled={disabled}
        onPointerDown={(e) => onDragStart(e, region, "move")}
        onClick={() => onSelect(region)}
        onKeyDown={(e) => onKeyDown(e, region)}
      />
      <span className="chai-edit-card__badge" aria-hidden="true">
        {region.number}
      </span>
      {selected &&
        CORNERS.map((corner) => (
          <span
            key={corner}
            className={`chai-edit-card__handle chai-edit-card__handle--${corner}`}
            aria-hidden="true"
            onPointerDown={(e) => onDragStart(e, region, corner)}
          />
        ))}
    </div>
  );
}

function boxStyle(r: EditRegion): CSSProperties {
  return {
    left: `${r.box.x * 100}%`,
    top: `${r.box.y * 100}%`,
    width: `${r.box.width * 100}%`,
    height: `${r.box.height * 100}%`,
    "--chai-region-color": regionColor(r.number),
  } as CSSProperties;
}

/** The full-size image in a modal dialog: focus moves in, Escape closes, and focus returns to Expand. */
function ExpandedImage({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  return (
    <div
      className="chai-result-card__expand-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded image"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        } else if (e.key === "Tab") {
          // One control inside: keep focus on it.
          e.preventDefault();
          closeRef.current?.focus();
        }
      }}
    >
      <div className="chai-result-card__expand-scrim" role="presentation" onClick={onClose} />
      <div className="chai-result-card__expand-frame">
        <img className="chai-result-card__image" src={src} alt={alt} />
        <button ref={closeRef} type="button" className="chai-result-card__collapse" aria-label="Collapse" onClick={onClose}>
          <CloseSymbolIcon />
        </button>
      </div>
    </div>
  );
}
