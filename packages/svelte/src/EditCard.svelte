<script lang="ts">
  /**
   * The image editing card: the person marks regions on the image, gives each
   * one an instruction, and checks it into the Composer. It shares
   * ResultCard's frame, with region actions where the votes would be.
   *
   * Drop it in with `useComposer`'s `edit`, sharing the regions with the
   * Composer's. Each edit's result comes back as a new version. Same props as
   * React's `EditCard`.
   *
   * - "New region" adds a box with a prompt field. Check adds the region to
   *   the Composer; trash removes it. Clicking a region reopens its field.
   * - Drag a region to move it, or a corner to resize it. By keyboard:
   *   arrows move the selected region, Shift + arrows resize it.
   * - Zoom keeps the image inside the card; drag (or arrow keys) to pan.
   */
  import { onMount, tick } from "svelte";
  import {
    clampPan,
    DEFAULT_MAX_REGIONS,
    downloadFilename,
    downloadMedia,
    EDIT_ZOOM_STEPS,
    editCardEvents,
    editCardWidth,
    fitBox,
    freeRegionNumber,
    newRegion,
    panForKey,
    panForZoom,
    regionBoxForKey,
    regionBoxStyle,
    regionPopoverPosition,
    resizeBox,
    shareMedia,
    type ChaiEvent,
    type EditRegion,
    type EditVersion,
    type Pan,
    type RegionBox,
    type RegionCorner,
    type Size,
  } from "@chai-ui/core";
  import ExpandedImage from "./edit-card/ExpandedImage.svelte";
  import RegionShape from "./edit-card/RegionShape.svelte";
  import Icon from "./Icon.svelte";
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
  import PageSlide from "./PageSlide.svelte";
  import { usePageSlide } from "./page-slide.svelte.js";
  import Pagination from "./primitives/Pagination.svelte";
  import { styleString } from "./style.js";

  let {
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
    onEvent,
  }: {
    /** The original image first, then each edit. Paged with the dots in the card's bottom row. */
    versions: EditVersion[];
    activeVersion: number;
    onActiveVersionChange: (index: number) => void;
    /** The new regions on the image, each committed with its instruction. Share them with the Composer's `regions`. */
    regions: EditRegion[];
    onRegionsChange: (next: EditRegion[]) => void;
    /** The most regions the chosen model takes (`ModelOption.maxRegions`). "New region" is disabled at this many. */
    maxRegions?: number;
    /** A fixed starting width in px, fitted within `maxWidth` and `maxHeight`. */
    width?: number;
    /** Sizes the card from the image's own pixel width: `0.3` makes it 30% as wide as the image. */
    scale?: number;
    /** The widest the card gets, in px. With no `width` or `scale`, the card fills `maxWidth` × `maxHeight`, keeping the image's shape. */
    maxWidth?: number;
    /** The tallest the card gets, in px. */
    maxHeight?: number;
    /** Alt text for the image. */
    alt?: string;
    /** After the card downloads or shares the version showing. */
    onAction?: (action: "download" | "share", version: EditVersion) => void;
    disabled?: boolean;
    /** Front-end analytics: regions added, confirmed and removed, zoom, paging through versions, download and share, one `ChaiEvent` each. Moving and resizing aren't reported. */
    onEvent?: (event: ChaiEvent) => void;
  } = $props();

  type Drag =
    | { kind: "move" | RegionCorner; id: string; x: number; y: number; box: RegionBox; moved: boolean }
    | { kind: "pan"; x: number; y: number; pan: Pan; moved: boolean };

  const index = $derived(Math.min(Math.max(activeVersion, 0), Math.max(0, versions.length - 1)));
  const version = $derived(versions[index]);
  const ready = $derived(version?.status === "done" && Boolean(version.src));
  const paginated = $derived(versions.length > 1);
  const hasImage = $derived(Boolean(version?.src || version?.from));

  // A region being drawn, not yet checked into the Composer.
  let draft = $state<EditRegion | null>(null);
  let selectedId = $state<string | null>(null);
  let text = $state("");
  let hidden = $state(false);
  let zoom = $state(1);
  let pan = $state<Pan>({ x: 0, y: 0 });
  let size = $state<Size>({ width: 0, height: 0 });
  // The shown image's own pixel size, kept until the next version's image loads, so the card doesn't jump between.
  let natural = $state<Size | null>(null);
  let expanded = $state(false);
  let linkCopied = $state(false);
  let drag: Drag | null = null;
  let viewport = $state<HTMLElement>();
  let field = $state<HTMLTextAreaElement>();

  // Paging slides between versions, and a different version starts clean: no half-drawn region, no zoom.
  const pageSlide = usePageSlide(() => ({ id: version?.id, index, image: version?.src ?? version?.from }));
  // svelte-ignore state_referenced_locally
  let shownVersionId = version?.id;
  $effect.pre(() => {
    const id = version?.id;
    if (id === shownVersionId) return;
    shownVersionId = id;
    draft = null;
    selectedId = null;
    zoom = 1;
    pan = { x: 0, y: 0 };
  });

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) size = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
    if (viewport) observer.observe(viewport);
    return () => observer.disconnect();
  });

  // A region being drawn takes a free number, even if the regions changed
  // since it was started (so checking it in can't duplicate a number).
  const shownDraft = $derived(draft && regions.some((r) => r.number === draft!.number) ? { ...draft, number: freeRegionNumber(regions) } : draft);
  const all = $derived(shownDraft ? [...regions, shownDraft] : regions);
  const selected = $derived(all.find((r) => r.id === selectedId) ?? null);
  const isDraft = $derived(selected != null && selected.id === draft?.id);
  const canCheck = $derived(selected != null && text.trim().length > 0 && (isDraft || text.trim() !== selected.prompt));
  const atCap = $derived(all.length >= maxRegions);
  const anyRegions = $derived(all.length > 0 || (version?.regions.length ?? 0) > 0);
  const zoomIndex = $derived(EDIT_ZOOM_STEPS.indexOf(zoom));
  // The field sits above its region, or below it when there isn't room above.
  const popover = $derived(selected && !hidden && size.width ? regionPopoverPosition(selected.box, zoom, pan, size, paginated) : null);
  const cardWidth = $derived(editCardWidth(natural, { width, scale, maxWidth, maxHeight }));

  // The field opens focused, so a new region can be described straight away.
  $effect(() => {
    if (selectedId) void tick().then(() => field?.focus());
  });
  // The field grows with its text instead of scrolling it out of view.
  $effect(() => {
    void text;
    void selectedId;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  });

  function select(region: EditRegion | null) {
    selectedId = region?.id ?? null;
    text = region?.prompt ?? "";
  }

  function setBox(id: string, box: RegionBox) {
    if (draft?.id === id) draft = { ...draft, box };
    else onRegionsChange(regions.map((r) => (r.id === id ? { ...r, box } : r)));
  }

  // A confirmed region going is reported; discarding an unconfirmed draft isn't.
  function removeRegion(region: EditRegion) {
    if (region.id === draft?.id) draft = null;
    else {
      const next = regions.filter((r) => r.id !== region.id);
      onEvent?.(editCardEvents.regionRemoved(next.length));
      onRegionsChange(next);
    }
    select(null);
  }

  function addRegion() {
    const region = newRegion(regions, zoom, pan, size);
    onEvent?.(editCardEvents.regionAdded(regions.length + 1));
    draft = region;
    hidden = false;
    select(region);
  }

  function check() {
    const region = selected;
    if (!region || !canCheck) return;
    const prompt = text.trim();
    onEvent?.(editCardEvents.regionConfirmed(isDraft ? regions.length + 1 : regions.length, prompt.length));
    if (isDraft) {
      onRegionsChange([...regions, { ...region, prompt }]);
      draft = null;
    } else {
      onRegionsChange(regions.map((r) => (r.id === region.id ? { ...r, prompt } : r)));
    }
    select(null);
  }

  function clearAll() {
    draft = null;
    select(null);
    if (regions.length > 0) onEvent?.(editCardEvents.regionRemoved(0));
    onRegionsChange([]);
  }

  function toggleHidden() {
    hidden = !hidden;
    select(null);
  }

  function pageTo(next: number) {
    onEvent?.(editCardEvents.versionPaged(next, versions.length));
    onActiveVersionChange(next);
  }

  function zoomTo(next: number) {
    onEvent?.(editCardEvents.zoomed(next));
    pan = panForZoom(pan, zoom, next, size);
    zoom = next;
  }

  // --- Pointer: move and resize regions, pan the zoomed image. Moves and
  // releases bubble to the viewport, even while a region or handle holds the
  // pointer capture, so the viewport handles them all.

  function startRegionDrag(e: PointerEvent, region: EditRegion, kind: "move" | RegionCorner) {
    if (disabled || e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { kind, id: region.id, x: e.clientX, y: e.clientY, box: region.box, moved: false };
    if (region.id !== selectedId) select(region);
  }

  function startPan(e: PointerEvent) {
    if (e.button !== 0) return;
    if (zoom > 1) (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { kind: "pan", x: e.clientX, y: e.clientY, pan, moved: false };
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag;
    if (!d || !size.width) return;
    const dxPx = e.clientX - d.x;
    const dyPx = e.clientY - d.y;
    if (Math.abs(dxPx) + Math.abs(dyPx) > 2) d.moved = true;
    if (d.kind === "pan") {
      if (zoom > 1) pan = clampPan({ x: d.pan.x + dxPx, y: d.pan.y + dyPx }, zoom, size);
      return;
    }
    const dx = dxPx / (size.width * zoom);
    const dy = dyPx / (size.height * zoom);
    setBox(d.id, d.kind === "move" ? fitBox({ ...d.box, x: d.box.x + dx, y: d.box.y + dy }) : resizeBox(d.box, d.kind, dx, dy));
  }

  function onPointerUp() {
    const d = drag;
    drag = null;
    // A click on the image itself (not a drag) closes the open field.
    if (d?.kind === "pan" && !d.moved) select(null);
  }

  // --- Keyboard

  function onRegionKey(e: KeyboardEvent, region: EditRegion) {
    const box = regionBoxForKey(region.box, e.key, { shift: e.shiftKey, alt: e.altKey });
    if (box) {
      e.preventDefault();
      e.stopPropagation();
      setBox(region.id, box);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeRegion(region);
    }
  }

  function onViewportKey(e: KeyboardEvent) {
    if (e.target !== e.currentTarget || zoom <= 1) return;
    const next = panForKey(pan, e.key, zoom, size);
    if (!next) return;
    e.preventDefault();
    pan = next;
  }

  function onFieldKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      check();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (isDraft) draft = null;
      select(null);
    }
  }

  // --- Media actions

  async function download() {
    const v = version;
    if (!v?.src) return;
    await downloadMedia(v.src, downloadFilename(v.id, "image", v.src));
    onEvent?.(editCardEvents.action("download"));
    onAction?.("download", v);
  }

  async function share() {
    const v = version;
    if (!v?.src) return;
    // With no share sheet the link is copied; say so, or the click looks like nothing happened.
    if ((await shareMedia(v.src)) === "copied") {
      linkCopied = true;
      setTimeout(() => (linkCopied = false), 1500);
    }
    onEvent?.(editCardEvents.action("share"));
    onAction?.("share", v);
  }

  function onload(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    natural = { width: img.naturalWidth, height: img.naturalHeight };
  }

  const stop = (e: Event) => e.stopPropagation();
</script>

{#if version}
  <div class="chai-edit-card" style:--chai-edit-card-width={`${cardWidth}px`}>
    <!-- The pointer handlers pan the zoomed image; arrow keys do the same once it's focusable (zoomed in). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      bind:this={viewport}
      class={["chai-edit-card__viewport", { "chai-edit-card__viewport--zoomed": zoom > 1 }]}
      role="group"
      aria-label={zoom > 1 ? `Image, zoomed to ${Math.round(zoom * 100)}%. Arrow keys move around.` : "Image"}
      tabindex={zoom > 1 ? 0 : undefined}
      onpointerdown={startPan}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onkeydown={onViewportKey}
    >
      <PageSlide slide={pageSlide.slide} onEnd={pageSlide.endSlide}>
        <div class="chai-edit-card__layer" style:transform={`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`} style:--chai-edit-zoom={zoom}>
          {#if version.src || version.from}
            <img class="chai-edit-card__image" src={version.src ?? version.from} {alt} draggable="false" {onload} />
          {:else}
            <div class="chai-edit-card__placeholder"></div>
          {/if}

          {#if !hidden}
            {#each version.regions as r (`applied-${r.id}`)}
              <span class="chai-edit-card__region chai-edit-card__region--applied" style={styleString(regionBoxStyle(r))} aria-hidden="true"
              ></span>
            {/each}
            {#if ready}
              {#each all as r (r.id)}
                <RegionShape
                  region={r}
                  selected={r.id === selectedId}
                  draft={r.id === draft?.id}
                  {disabled}
                  onDragStart={(e, kind) => startRegionDrag(e, r, kind)}
                  onSelect={() => select(r)}
                  onKeydown={(e) => onRegionKey(e, r)}
                />
              {/each}
            {/if}
          {/if}
        </div>
      </PageSlide>

      {#if version.status !== "done"}
        <div class="chai-edit-card__status" role="status">
          {#if version.status === "queued" || version.status === "running"}
            <span class="chai-edit-card__spinner" role="img" aria-label="Editing"></span>
          {:else}
            <p class="chai-edit-card__status-text">{version.status === "cancelled" ? "Stopped" : (version.error ?? "Something went wrong.")}</p>
          {/if}
        </div>
      {/if}

      <!-- Translucent backings keep these readable on any image. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="chai-card-top chai-card-top--start" onpointerdown={stop}>
        <button
          type="button"
          class="chai-card-top-btn"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={!ready || zoomIndex >= EDIT_ZOOM_STEPS.length - 1}
          onclick={() => zoomTo(EDIT_ZOOM_STEPS[zoomIndex + 1]!)}
        >
          <Icon icon={ZoomInIcon} />
        </button>
        <span class="chai-edit-card__zoom-level" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          class="chai-card-top-btn"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={!ready || zoomIndex <= 0}
          onclick={() => zoomTo(EDIT_ZOOM_STEPS[zoomIndex - 1]!)}
        >
          <Icon icon={ZoomOutIcon} />
        </button>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="chai-card-top chai-card-top--end" onpointerdown={stop}>
        <button type="button" class="chai-card-top-btn" aria-label="Download" title="Download" disabled={disabled || !ready} onclick={download}>
          <Icon icon={DownloadIcon} />
        </button>
        <button
          type="button"
          class="chai-card-top-btn"
          aria-label={linkCopied ? "Link copied" : "Share"}
          title={linkCopied ? "Link copied" : "Share"}
          disabled={disabled || !ready}
          onclick={share}
        >
          <Icon icon={linkCopied ? CheckSymbolIcon : ShareIcon} />
        </button>
        <button type="button" class="chai-card-top-btn" aria-label="Expand" title="Expand" disabled={!ready} onclick={() => (expanded = true)}>
          <Icon icon={ExpandIcon} />
        </button>
      </div>

      {#if paginated && hasImage}<div class="chai-card-fade"></div>{/if}

      <!-- Over the bottom of the image (it fills the card): the region actions. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="chai-card-bottom" onpointerdown={stop}>
        <div class="chai-card-actions">
          <div class="chai-card-chips">
            <button
              type="button"
              class="chai-card-chip"
              disabled={disabled || !ready || atCap}
              title={atCap ? `This model takes up to ${maxRegions} regions` : undefined}
              onclick={addRegion}
            >
              <Icon icon={AddIcon} />New region
            </button>
            <button type="button" class="chai-card-chip" disabled={disabled || all.length === 0} onclick={clearAll}>
              <Icon icon={CloseSymbolIcon} />Clear regions
            </button>
          </div>
          <!-- Named, and given a tooltip, by what a press will do. -->
          <button
            type="button"
            class="chai-card-round"
            aria-label={hidden ? "Show regions" : "Hide regions"}
            title={hidden ? "Show regions" : "Hide regions"}
            disabled={!anyRegions}
            onclick={toggleHidden}
          >
            <Icon icon={hidden ? VisibilityOffIcon : VisibilityIcon} />
          </button>
        </div>
      </div>

      {#if popover && selected}
        <!-- Its field takes focus when it opens: the dialog itself needs no tab stop. The pointer
             handler only keeps a press inside it from reaching the viewport's pan. -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_interactive_supports_focus -->
        <div
          class={["chai-edit-card__popover", { "chai-edit-card__popover--above": popover.above }]}
          style:left={`${popover.left}px`}
          style:top={`${popover.top}px`}
          role="dialog"
          aria-label={`Region ${selected.number}`}
          onpointerdown={stop}
        >
          <div class="chai-edit-card__popover-header">
            <span class="chai-edit-card__popover-title">Region {selected.number}</span>
            <button
              type="button"
              class="chai-card-top-btn"
              aria-label="Add region to prompt"
              title="Add region to prompt"
              disabled={disabled || !canCheck}
              onclick={check}
            >
              <Icon icon={CheckSymbolIcon} />
            </button>
            <button
              type="button"
              class="chai-card-top-btn"
              aria-label="Delete region"
              title="Delete region"
              {disabled}
              onclick={() => removeRegion(selected)}
            >
              <Icon icon={DeleteIcon} />
            </button>
          </div>
          <textarea
            bind:this={field}
            bind:value={text}
            class="chai-edit-card__field"
            rows="1"
            placeholder="What should change here?"
            aria-label={`Instruction for region ${selected.number}`}
            {disabled}
            onkeydown={onFieldKey}
          ></textarea>
        </div>
      {/if}
    </div>

    <!-- The version dots are the card's last row, under the image. -->
    {#if paginated}
      <div class={["chai-card-pager-bar", { "chai-card-pager-bar--over-media": hasImage }]}>
        <Pagination count={versions.length} {index} label="Versions" itemLabel="Version" {disabled} onChange={pageTo} />
      </div>
    {/if}
  </div>

  <!-- The expanded view reuses the result card's dialog, outside the card for the same reason. -->
  {#if expanded && version.src}
    <ExpandedImage src={version.src} {alt} onClose={() => (expanded = false)} />
  {/if}
{/if}
