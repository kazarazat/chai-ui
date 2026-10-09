import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import {
  clampPan,
  DEFAULT_MAX_REGIONS,
  downloadFilename,
  downloadMedia,
  EDIT_ZOOM_STEPS,
  editCardWidth,
  fitBox,
  freeRegionNumber,
  newRegion,
  panForKey,
  panForZoom,
  REGION_CORNERS,
  regionBoxForKey,
  regionBoxStyle,
  regionPopoverPosition,
  resizeBox,
  shareMedia,
  type EditRegion,
  type EditVersion,
  type Pan,
  type RegionBox,
  type RegionCorner,
  type Size,
} from "@chai-ui/core";

export type { EditVersion } from "@chai-ui/core";
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
import { PageSlide, usePageSlide } from "./page-slide.js";

export interface EditCardProps {
  /** The original image first, then each edit. Paged with the dots in the card's bottom row. */
  versions: EditVersion[];
  activeVersion: number;
  onActiveVersionChange: (index: number) => void;
  /** The new regions on the image, each committed with its instruction. Controlled: share them with `Composer`'s `regions`. */
  regions: EditRegion[];
  onRegionsChange: (next: EditRegion[]) => void;
  /** The most regions the chosen model takes (`ModelOption.maxRegions`). "New region" is disabled at this many. Defaults to 6. */
  maxRegions?: number;
  /** A fixed starting width in px, fitted within `maxWidth` and `maxHeight`. Without it (and without `scale`), the card is as large as fits in that box. */
  width?: number;
  /**
   * Sizes the card from the image's own pixel width: `0.3` makes it 30% as
   * wide as the image (a 5000px photo gives a 1500px card). The height
   * follows the image's shape, and the card is never wider than its
   * container. Each version is measured on its own, since an edit can come
   * back a different size.
   */
  scale?: number;
  /** The widest the card gets, in px. Defaults to 630. With no `width` or `scale`, the card fills `maxWidth` × `maxHeight`, keeping the image's shape. */
  maxWidth?: number;
  /** The tallest the card gets, in px. Defaults to 630. A tall image narrows the card to fit, keeping its shape. */
  maxHeight?: number;
  /** Alt text for the image. Defaults to "Image being edited". */
  alt?: string;
  /** Fires after the card downloads or shares the version showing. */
  onAction?: (action: "download" | "share", version: EditVersion) => void;
  disabled?: boolean;
}

type Drag =
  | { kind: "move" | RegionCorner; id: string; x: number; y: number; box: RegionBox; moved: boolean }
  | { kind: "pan"; x: number; y: number; pan: Pan; moved: boolean };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

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
  scale,
  maxWidth = 630,
  maxHeight = 630,
  alt = "Image being edited",
  onAction,
  disabled = false,
}: EditCardProps) {
  const index = clamp(activeVersion, 0, Math.max(0, versions.length - 1));
  const version = versions[index];
  const ready = version?.status === "done" && Boolean(version.src);
  const paginated = versions.length > 1;
  const hasImage = Boolean(version?.src || version?.from);

  // A region being drawn, not yet checked into the Composer.
  const [draft, setDraft] = useState<EditRegion | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [hidden, setHidden] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  // The shown image's own pixel size, for `scale` and the max height. Kept
  // until the next version's image loads, so the card doesn't jump between.
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
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
    draft && regions.some((r) => r.number === draft.number) ? { ...draft, number: freeRegionNumber(regions) } : draft;
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
    const region = newRegion(regions, zoom, pan, size);
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
    setPan(panForZoom(pan, zoom, next, size));
    setZoom(next);
  }
  const zoomIndex = EDIT_ZOOM_STEPS.indexOf(zoom);

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
    const box = regionBoxForKey(region.box, e.key, { shift: e.shiftKey, alt: e.altKey });
    if (box) {
      e.preventDefault();
      e.stopPropagation();
      setBox(region.id, box);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (region.id === draft?.id) setDraft(null);
      else onRegionsChange(regions.filter((r) => r.id !== region.id));
      select(null);
    }
  }

  function handleViewportKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || zoom <= 1) return;
    const next = panForKey(pan, e.key, zoom, size);
    if (!next) return;
    e.preventDefault();
    setPan(next);
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
    // With no share sheet the link is copied; say so, or the click looks like nothing happened.
    if ((await shareMedia(version.src)) === "copied") {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    }
    onAction?.("share", version);
  };

  // --- Layout ---

  // The field sits above its region, or below it when there isn't room above.
  const popover = selected && !hidden && size.width ? regionPopoverPosition(selected.box, zoom, pan, size, versions.length > 1) : null;

  if (!version) return null;

  const cardWidth = editCardWidth(natural, { width, scale, maxWidth, maxHeight });

  return (
    <>
      <div
        className="chai-edit-card"
        style={{ "--chai-edit-card-width": `${cardWidth}px` } as CSSProperties}
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
              <img
                className="chai-edit-card__image"
                src={version.src ?? version.from}
                alt={alt}
                draggable={false}
                onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
              />
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
              disabled={!ready || zoomIndex >= EDIT_ZOOM_STEPS.length - 1}
              onClick={() => zoomTo(EDIT_ZOOM_STEPS[zoomIndex + 1]!)}
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
              onClick={() => zoomTo(EDIT_ZOOM_STEPS[zoomIndex - 1]!)}
            >
              <ZoomOutIcon />
            </button>
          </div>

          <div className="chai-card-top chai-card-top--end" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="chai-card-top-btn" aria-label="Download" title="Download" disabled={disabled || !ready} onClick={handleDownload}>
              <DownloadIcon />
            </button>
            <button
              type="button"
              className="chai-card-top-btn"
              aria-label={linkCopied ? "Link copied" : "Share"}
              title={linkCopied ? "Link copied" : "Share"}
              disabled={disabled || !ready}
              onClick={handleShare}
            >
              {linkCopied ? <CheckSymbolIcon /> : <ShareIcon />}
            </button>
            <button type="button" className="chai-card-top-btn" aria-label="Expand" title="Expand" disabled={!ready} onClick={() => setExpanded(true)}>
              <ExpandIcon />
            </button>
          </div>

          {paginated && hasImage && <div className="chai-card-fade" />}

          {/* Over the bottom of the image (it fills the card): the region actions. */}
          <div className="chai-card-bottom" onPointerDown={(e) => e.stopPropagation()}>
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

        {/* The version dots are the card's last row, under the image. */}
        {paginated && (
          <div className={`chai-card-pager-bar${hasImage ? " chai-card-pager-bar--over-media" : ""}`}>
            <Pagination count={versions.length} index={index} onChange={onActiveVersionChange} label="Versions" itemLabel="Version" disabled={disabled} />
          </div>
        )}
      </div>

      {/* The expanded view reuses the result card's dialog, outside the card for the same reason. */}
      {expanded && version.src && (
        <ExpandedImage src={version.src} alt={alt} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

type DragKind = "move" | RegionCorner;

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
        REGION_CORNERS.map((corner) => (
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

const boxStyle = (r: EditRegion) => regionBoxStyle(r) as CSSProperties;

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
