<script setup lang="ts">
/**
 * The image editing card: the person marks regions on the image, gives each
 * one an instruction, and checks it into the Composer. It shares
 * ResultCard's frame, with region actions where the votes would be.
 *
 * Drop it in with `useComposer`'s `edit`: `v-model:active-version` and
 * `v-model:regions`, sharing the regions with the Composer's. Each edit's
 * result comes back as a new version. Same props as React's `EditCard`.
 *
 * - "New region" adds a box with a prompt field. Check adds the region to
 *   the Composer; trash removes it. Clicking a region reopens its field.
 * - Drag a region to move it, or a corner to resize it. By keyboard:
 *   arrows move the selected region, Shift + arrows resize it.
 * - Zoom keeps the image inside the card; drag (or arrow keys) to pan.
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
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
import ExpandedImage from "./edit-card/ExpandedImage.vue";
import RegionShape from "./edit-card/RegionShape.vue";
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
import PageSlide from "./PageSlide.vue";
import { usePageSlide } from "./page-slide.js";
import Pagination from "./primitives/Pagination.vue";

const props = withDefaults(
  defineProps<{
    /** The original image first, then each edit. Paged with the dots in the card's bottom row. */
    versions: EditVersion[];
    activeVersion: number;
    /** The new regions on the image, each committed with its instruction. Share them with the Composer's `regions`. */
    regions: EditRegion[];
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
    disabled?: boolean;
  }>(),
  { maxRegions: DEFAULT_MAX_REGIONS, maxWidth: 630, maxHeight: 630, alt: "Image being edited" }
);
const emit = defineEmits<{
  "update:activeVersion": [index: number];
  "update:regions": [next: EditRegion[]];
  /** After the card downloads or shares the version showing. */
  action: [action: "download" | "share", version: EditVersion];
}>();

type Drag =
  | { kind: "move" | RegionCorner; id: string; x: number; y: number; box: RegionBox; moved: boolean }
  | { kind: "pan"; x: number; y: number; pan: Pan; moved: boolean };

const index = computed(() => Math.min(Math.max(props.activeVersion, 0), Math.max(0, props.versions.length - 1)));
const version = computed(() => props.versions[index.value]);
const ready = computed(() => version.value?.status === "done" && Boolean(version.value.src));
const paginated = computed(() => props.versions.length > 1);
const hasImage = computed(() => Boolean(version.value?.src || version.value?.from));

// A region being drawn, not yet checked into the Composer.
const draft = ref<EditRegion | null>(null);
const selectedId = ref<string | null>(null);
const text = ref("");
const hidden = ref(false);
const zoom = ref(1);
const pan = ref<Pan>({ x: 0, y: 0 });
const size = ref<Size>({ width: 0, height: 0 });
// The shown image's own pixel size, kept until the next version's image loads, so the card doesn't jump between.
const natural = ref<Size | null>(null);
const expanded = ref(false);
const linkCopied = ref(false);
let drag: Drag | null = null;
const viewport = ref<HTMLElement>();
const field = ref<HTMLTextAreaElement>();

// Paging slides between versions, and a different version starts clean: no half-drawn region, no zoom.
const { slide, endSlide } = usePageSlide(() => ({
  id: version.value?.id,
  index: index.value,
  image: version.value?.src ?? version.value?.from,
}));
watch(
  () => version.value?.id,
  () => {
    draft.value = null;
    selectedId.value = null;
    zoom.value = 1;
    pan.value = { x: 0, y: 0 };
  }
);

let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) size.value = { width: entry.contentRect.width, height: entry.contentRect.height };
  });
  if (viewport.value) observer.observe(viewport.value);
});
onUnmounted(() => observer?.disconnect());

// A region being drawn takes a free number, even if the regions changed
// since it was started (so checking it in can't duplicate a number).
const shownDraft = computed(() => {
  const d = draft.value;
  return d && props.regions.some((r) => r.number === d.number) ? { ...d, number: freeRegionNumber(props.regions) } : d;
});
const all = computed(() => (shownDraft.value ? [...props.regions, shownDraft.value] : props.regions));
const selected = computed(() => all.value.find((r) => r.id === selectedId.value) ?? null);
const isDraft = computed(() => selected.value != null && selected.value.id === draft.value?.id);
const canCheck = computed(
  () => selected.value != null && text.value.trim().length > 0 && (isDraft.value || text.value.trim() !== selected.value.prompt)
);
const atCap = computed(() => all.value.length >= props.maxRegions);
const anyRegions = computed(() => all.value.length > 0 || (version.value?.regions.length ?? 0) > 0);
const zoomIndex = computed(() => EDIT_ZOOM_STEPS.indexOf(zoom.value));
// The field sits above its region, or below it when there isn't room above.
const popover = computed(() =>
  selected.value && !hidden.value && size.value.width
    ? regionPopoverPosition(selected.value.box, zoom.value, pan.value, size.value, paginated.value)
    : null
);
const cardWidth = computed(() =>
  editCardWidth(natural.value, { width: props.width, scale: props.scale, maxWidth: props.maxWidth, maxHeight: props.maxHeight })
);

// The field opens focused, so a new region can be described straight away.
watch(selectedId, (id) => id && field.value?.focus(), { flush: "post" });
// The field grows with its text instead of scrolling it out of view.
watch(
  [text, selectedId],
  () => {
    const el = field.value;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  },
  { flush: "post" }
);

function select(region: EditRegion | null) {
  selectedId.value = region?.id ?? null;
  text.value = region?.prompt ?? "";
}

function setBox(id: string, box: RegionBox) {
  if (draft.value?.id === id) draft.value = { ...draft.value, box };
  else emit("update:regions", props.regions.map((r) => (r.id === id ? { ...r, box } : r)));
}

function removeRegion(region: EditRegion) {
  if (region.id === draft.value?.id) draft.value = null;
  else emit("update:regions", props.regions.filter((r) => r.id !== region.id));
  select(null);
}

function addRegion() {
  const region = newRegion(props.regions, zoom.value, pan.value, size.value);
  draft.value = region;
  hidden.value = false;
  select(region);
}

function check() {
  const region = selected.value;
  if (!region || !canCheck.value) return;
  const prompt = text.value.trim();
  if (isDraft.value) {
    emit("update:regions", [...props.regions, { ...region, prompt }]);
    draft.value = null;
  } else {
    emit("update:regions", props.regions.map((r) => (r.id === region.id ? { ...r, prompt } : r)));
  }
  select(null);
}

function clearAll() {
  draft.value = null;
  select(null);
  emit("update:regions", []);
}

function toggleHidden() {
  hidden.value = !hidden.value;
  select(null);
}

function zoomTo(next: number) {
  pan.value = panForZoom(pan.value, zoom.value, next, size.value);
  zoom.value = next;
}

// --- Pointer: move and resize regions, pan the zoomed image. Moves and
// releases bubble to the viewport, even while a region or handle holds the
// pointer capture, so the viewport handles them all.

function startRegionDrag(e: PointerEvent, region: EditRegion, kind: "move" | RegionCorner) {
  if (props.disabled || e.button !== 0) return;
  e.stopPropagation();
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  drag = { kind, id: region.id, x: e.clientX, y: e.clientY, box: region.box, moved: false };
  if (region.id !== selectedId.value) select(region);
}

function startPan(e: PointerEvent) {
  if (e.button !== 0) return;
  if (zoom.value > 1) (e.currentTarget as Element).setPointerCapture(e.pointerId);
  drag = { kind: "pan", x: e.clientX, y: e.clientY, pan: pan.value, moved: false };
}

function onPointerMove(e: PointerEvent) {
  const d = drag;
  const { width, height } = size.value;
  if (!d || !width) return;
  const dxPx = e.clientX - d.x;
  const dyPx = e.clientY - d.y;
  if (Math.abs(dxPx) + Math.abs(dyPx) > 2) d.moved = true;
  if (d.kind === "pan") {
    if (zoom.value > 1) pan.value = clampPan({ x: d.pan.x + dxPx, y: d.pan.y + dyPx }, zoom.value, size.value);
    return;
  }
  const dx = dxPx / (width * zoom.value);
  const dy = dyPx / (height * zoom.value);
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
  if (e.target !== e.currentTarget || zoom.value <= 1) return;
  const next = panForKey(pan.value, e.key, zoom.value, size.value);
  if (!next) return;
  e.preventDefault();
  pan.value = next;
}

function onFieldKey(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    check();
  } else if (e.key === "Escape") {
    e.preventDefault();
    if (isDraft.value) draft.value = null;
    select(null);
  }
}

// --- Media actions

async function download() {
  const v = version.value;
  if (!v?.src) return;
  await downloadMedia(v.src, downloadFilename(v.id, "image", v.src));
  emit("action", "download", v);
}

async function share() {
  const v = version.value;
  if (!v?.src) return;
  // With no share sheet the link is copied; say so, or the click looks like nothing happened.
  if ((await shareMedia(v.src)) === "copied") {
    linkCopied.value = true;
    setTimeout(() => (linkCopied.value = false), 1500);
  }
  emit("action", "share", v);
}

function onImageLoad(e: Event) {
  const img = e.currentTarget as HTMLImageElement;
  natural.value = { width: img.naturalWidth, height: img.naturalHeight };
}
</script>

<template>
  <template v-if="version">
    <div class="chai-edit-card" :style="{ '--chai-edit-card-width': `${cardWidth}px` }">
      <div
        ref="viewport"
        :class="['chai-edit-card__viewport', { 'chai-edit-card__viewport--zoomed': zoom > 1 }]"
        role="group"
        :aria-label="zoom > 1 ? `Image, zoomed to ${Math.round(zoom * 100)}%. Arrow keys move around.` : 'Image'"
        :tabindex="zoom > 1 ? 0 : undefined"
        @pointerdown="startPan"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onViewportKey"
      >
        <PageSlide :slide="slide" @end="endSlide">
          <div class="chai-edit-card__layer" :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, '--chai-edit-zoom': zoom }">
            <img
              v-if="version.src || version.from"
              class="chai-edit-card__image"
              :src="version.src ?? version.from"
              :alt="alt"
              draggable="false"
              @load="onImageLoad"
            />
            <div v-else class="chai-edit-card__placeholder" />

            <template v-if="!hidden">
              <span
                v-for="r in version.regions"
                :key="`applied-${r.id}`"
                class="chai-edit-card__region chai-edit-card__region--applied"
                :style="regionBoxStyle(r)"
                aria-hidden="true"
              />
              <template v-if="ready">
                <RegionShape
                  v-for="r in all"
                  :key="r.id"
                  :region="r"
                  :selected="r.id === selectedId"
                  :draft="r.id === draft?.id"
                  :disabled="disabled"
                  @drag-start="(e, kind) => startRegionDrag(e, r, kind)"
                  @select="select(r)"
                  @keydown="onRegionKey($event, r)"
                />
              </template>
            </template>
          </div>
        </PageSlide>

        <div v-if="version.status !== 'done'" class="chai-edit-card__status" role="status">
          <span v-if="version.status === 'queued' || version.status === 'running'" class="chai-edit-card__spinner" role="img" aria-label="Editing" />
          <p v-else class="chai-edit-card__status-text">{{ version.status === "cancelled" ? "Stopped" : (version.error ?? "Something went wrong.") }}</p>
        </div>

        <!-- Translucent backings keep these readable on any image. -->
        <div class="chai-card-top chai-card-top--start" @pointerdown.stop>
          <button
            type="button"
            class="chai-card-top-btn"
            aria-label="Zoom in"
            title="Zoom in"
            :disabled="!ready || zoomIndex >= EDIT_ZOOM_STEPS.length - 1"
            @click="zoomTo(EDIT_ZOOM_STEPS[zoomIndex + 1]!)"
          >
            <ZoomInIcon />
          </button>
          <span class="chai-edit-card__zoom-level" aria-live="polite">{{ Math.round(zoom * 100) }}%</span>
          <button
            type="button"
            class="chai-card-top-btn"
            aria-label="Zoom out"
            title="Zoom out"
            :disabled="!ready || zoomIndex <= 0"
            @click="zoomTo(EDIT_ZOOM_STEPS[zoomIndex - 1]!)"
          >
            <ZoomOutIcon />
          </button>
        </div>

        <div class="chai-card-top chai-card-top--end" @pointerdown.stop>
          <button type="button" class="chai-card-top-btn" aria-label="Download" title="Download" :disabled="disabled || !ready" @click="download">
            <DownloadIcon />
          </button>
          <button
            type="button"
            class="chai-card-top-btn"
            :aria-label="linkCopied ? 'Link copied' : 'Share'"
            :title="linkCopied ? 'Link copied' : 'Share'"
            :disabled="disabled || !ready"
            @click="share"
          >
            <CheckSymbolIcon v-if="linkCopied" /><ShareIcon v-else />
          </button>
          <button type="button" class="chai-card-top-btn" aria-label="Expand" title="Expand" :disabled="!ready" @click="expanded = true">
            <ExpandIcon />
          </button>
        </div>

        <div v-if="paginated && hasImage" class="chai-card-fade" />

        <!-- Over the bottom of the image (it fills the card): the region actions. -->
        <div class="chai-card-bottom" @pointerdown.stop>
          <div class="chai-card-actions">
            <div class="chai-card-chips">
              <button
                type="button"
                class="chai-card-chip"
                :disabled="disabled || !ready || atCap"
                :title="atCap ? `This model takes up to ${maxRegions} regions` : undefined"
                @click="addRegion"
              >
                <AddIcon />New region
              </button>
              <button type="button" class="chai-card-chip" :disabled="disabled || all.length === 0" @click="clearAll">
                <CloseSymbolIcon />Clear regions
              </button>
            </div>
            <!-- Named, and given a tooltip, by what a press will do. -->
            <button
              type="button"
              class="chai-card-round"
              :aria-label="hidden ? 'Show regions' : 'Hide regions'"
              :title="hidden ? 'Show regions' : 'Hide regions'"
              :disabled="!anyRegions"
              @click="toggleHidden"
            >
              <VisibilityOffIcon v-if="hidden" /><VisibilityIcon v-else />
            </button>
          </div>
        </div>

        <div
          v-if="popover && selected"
          :class="['chai-edit-card__popover', { 'chai-edit-card__popover--above': popover.above }]"
          :style="{ left: `${popover.left}px`, top: `${popover.top}px` }"
          role="dialog"
          :aria-label="`Region ${selected.number}`"
          @pointerdown.stop
        >
          <div class="chai-edit-card__popover-header">
            <span class="chai-edit-card__popover-title">Region {{ selected.number }}</span>
            <button
              type="button"
              class="chai-card-top-btn"
              aria-label="Add region to prompt"
              title="Add region to prompt"
              :disabled="disabled || !canCheck"
              @click="check"
            >
              <CheckSymbolIcon />
            </button>
            <button type="button" class="chai-card-top-btn" aria-label="Delete region" title="Delete region" :disabled="disabled" @click="removeRegion(selected)">
              <DeleteIcon />
            </button>
          </div>
          <textarea
            ref="field"
            v-model="text"
            class="chai-edit-card__field"
            rows="1"
            placeholder="What should change here?"
            :aria-label="`Instruction for region ${selected.number}`"
            :disabled="disabled"
            @keydown="onFieldKey"
          />
        </div>
      </div>

      <!-- The version dots are the card's last row, under the image. -->
      <div v-if="paginated" :class="['chai-card-pager-bar', { 'chai-card-pager-bar--over-media': hasImage }]">
        <Pagination
          :count="versions.length"
          :index="index"
          label="Versions"
          item-label="Version"
          :disabled="disabled"
          @update:index="emit('update:activeVersion', $event)"
        />
      </div>
    </div>

    <!-- The expanded view reuses the result card's dialog, outside the card for the same reason. -->
    <ExpandedImage v-if="expanded && version.src" :src="version.src" :alt="alt" @close="expanded = false" />
  </template>
</template>
