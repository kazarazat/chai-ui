<script setup lang="ts">
/**
 * The Composer bar's complement, and the last stop in the pipeline: the
 * results from one prompt, one at a time, paged with the dots when there
 * are several. Flips to show the prompt and details. Same props as React's
 * `ResultCard`; `onAction` is the `action` event.
 */
import { computed, nextTick, reactive, ref, watch } from "vue";
import {
  downloadFilename,
  downloadMedia,
  formatAspectRatio,
  formatCost,
  formatDuration,
  formatTokens,
  resultModelLabel,
  shareMedia,
  type ModelOption,
  type Result,
} from "@chai-ui/core";
import { CheckIcon, CloseIcon, CopyIcon, InfoIcon, RefreshIcon, ThumbDownIcon, ThumbUpIcon } from "./icons.js";
import PageSlide from "./PageSlide.vue";
import { usePageSlide } from "./page-slide.js";
import Pagination from "./primitives/Pagination.vue";
import IconButton from "./result-card/IconButton.vue";
import MoreMenu from "./result-card/MoreMenu.vue";
import ResultMedia from "./result-card/ResultMedia.vue";
import VideoPlayer from "./result-card/VideoPlayer.vue";
import type { ResultCardMoreAction, ResultCardVote } from "./result-card/types.js";

const props = defineProps<{
  /** The results from one prompt: `results[0]` if there's only one, paged internally if more. */
  results: Result[];
  /** Fixed width in px. Defaults to 375; height follows the media. */
  width?: number;
  /** Max height in px of a text result before it scrolls. Defaults to 400. */
  textMaxHeight?: number;
  /** The request's prompt, shown read-only (copiable) on the info side. */
  prompt: string;
  /** Alt text for a generated image. Defaults to `prompt`. */
  altText?: (result: Result) => string;
  /** Resolves `Result.modelId` to a label, on the info side and beside the page dots. */
  models?: ModelOption[];
  /** A result's vote, if any. Controlled: what a vote means is the app's policy. */
  getVote?: (result: Result) => ResultCardVote;
  /** Extra items in the ⋯ menu. Omit to hide the menu. */
  moreActions?: ResultCardMoreAction[];
  disabled?: boolean;
}>();
const emit = defineEmits<{
  /** `"like"`, `"dislike"`, `"download"`, `"share"`, `"copy-prompt"`, `"retry"`, or a `moreActions` id. */
  action: [action: string, result: Result];
}>();

const activeIndex = ref(0);
const flipped = ref(false);
const copied = ref(false);
const linkCopied = ref(false);
const mediaExpanded = ref(false);
// Measured off the loaded media for the aspect-ratio chip, with the id it
// was measured from, so a stale ratio never shows after paging.
const measured = ref<{ id: string; width: number; height: number } | null>(null);
const videoTime = reactive({ current: 0 });
const videoWasPlaying = ref(false);
const front = ref<HTMLElement>();
const back = ref<HTMLElement>();
const overlay = ref<HTMLElement>();

const index = computed(() => Math.min(activeIndex.value, Math.max(0, props.results.length - 1)));
const result = computed(() => props.results[index.value]);
const kind = computed(() => result.value?.output?.kind);
const paginated = computed(() => props.results.length > 1);
// An image or video runs under a dark fade into the bar; text, audio and status pages keep the plain surface.
const overMedia = computed(() => kind.value === "image" || kind.value === "video");
const vote = computed(() => (result.value && props.getVote?.(result.value)) ?? null);
const modelLabel = computed(() => (result.value ? resultModelLabel(result.value, props.models) : ""));
const alt = computed(() => (result.value ? (props.altText?.(result.value) ?? props.prompt) : ""));
const chips = computed(() => {
  const r = result.value;
  const dims = measured.value?.id === r?.id ? measured.value : null;
  return [
    modelLabel.value,
    formatTokens(r?.usage?.totalTokens),
    formatCost(r?.usage?.costUsd),
    formatDuration(r?.durationMs),
    dims ? formatAspectRatio(dims.width, dims.height) : undefined,
  ].filter(Boolean) as string[];
});
const cardStyle = computed(() => ({
  ...(props.width != null && { "--chai-result-card-width": `${props.width}px` }),
  ...(props.textMaxHeight != null && { "--chai-result-card-text-max-height": `${props.textMaxHeight}px` }),
}));

// Paging slides, with the last image sliding out (other kinds just slide in).
const { slide, endSlide } = usePageSlide(() => ({
  id: result.value?.id,
  index: index.value,
  image: kind.value === "image" ? result.value!.output!.src : undefined,
}));

const act = (action: string) => emit("action", action, result.value!);

function flash(flag: typeof copied) {
  flag.value = true;
  setTimeout(() => (flag.value = false), 1500);
}

function copyPrompt() {
  navigator.clipboard?.writeText(props.prompt).catch(() => {});
  flash(copied);
  act("copy-prompt");
}

async function download() {
  const r = result.value!;
  if (r.output) await downloadMedia(r.output.src, downloadFilename(r.id, r.output.kind, r.output.src));
  emit("action", "download", r);
}

async function share() {
  const r = result.value!;
  // With no share sheet the link is copied; say so, or the click looks like nothing happened.
  if (r.output && (await shareMedia(r.output.src)) === "copied") flash(linkCopied);
  emit("action", "share", r);
}

// Flipping moves focus to the side now showing, so a keyboard user isn't left on a button that just turned away.
watch(
  flipped,
  (isFlipped) => {
    const target = isFlipped
      ? back.value?.querySelector<HTMLElement>('[aria-label="Close details"]')
      : front.value?.querySelector<HTMLElement>('[aria-label="Show details"]');
    target?.focus();
  },
  { flush: "post" }
);

// The expanded view is a modal dialog: focus moves in, Tab stays inside,
// Escape closes, and focus returns to Expand, the only way in.
watch(mediaExpanded, async (open) => {
  await nextTick();
  if (open) overlay.value?.querySelector<HTMLElement>(".chai-result-card__collapse")?.focus();
  else front.value?.querySelector<HTMLElement>('[aria-label="Expand"]')?.focus();
});

function onOverlayKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    mediaExpanded.value = false;
    return;
  }
  if (e.key !== "Tab") return;
  const focusable = [
    ...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button, [tabindex="0"], a[href], input, video[controls]'),
  ].filter((el) => !el.hasAttribute("disabled"));
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <template v-if="result">
    <div :class="['chai-result-card', { 'chai-result-card--flipped': flipped }]" :style="cardStyle">
      <div class="chai-result-card__inner">
        <!-- The face turned away is inert, so its buttons can't be tabbed to. -->
        <div
          ref="front"
          :class="['chai-result-card__face chai-result-card__front', { 'chai-result-card__front--paginated': paginated }]"
          :aria-hidden="flipped"
          :inert="flipped"
        >
          <div class="chai-result-card__media-frame">
            <PageSlide :slide="slide" page-class="chai-result-card__media-page" @end="endSlide">
              <ResultMedia
                :result="result"
                :alt="alt"
                :disabled="disabled"
                :media-expanded="mediaExpanded"
                :link-copied="linkCopied"
                :video-time="videoTime"
                :video-was-playing="videoWasPlaying"
                @download="download"
                @share="share"
                @expand="mediaExpanded = true"
                @dimensions="(w, h) => (measured = { id: result!.id, width: w, height: h })"
                @video-playing-change="videoWasPlaying = $event"
              />
            </PageSlide>
            <div v-if="paginated && overMedia" class="chai-card-fade" />
          </div>

          <!-- With several results, the page dots are the card's last row, with the model that made this page on the left. -->
          <div v-if="paginated" :class="['chai-card-pager-bar', { 'chai-card-pager-bar--over-media': overMedia }]">
            <span class="chai-card-pager-label">{{ modelLabel }}</span>
            <Pagination
              :count="results.length"
              :index="index"
              label="Results"
              :disabled="disabled"
              @update:index="activeIndex = $event"
            />
          </div>

          <!-- Floating over the bottom of the media: votes and retry in one pill, details on the right. -->
          <div class="chai-card-bottom">
            <div class="chai-card-actions">
              <div class="chai-card-pill">
                <IconButton variant="pill" label="Like" :active="vote === 'like'" :disabled="disabled" @click="act('like')">
                  <ThumbUpIcon />
                </IconButton>
                <IconButton variant="pill" label="Dislike" :active="vote === 'dislike'" :disabled="disabled" @click="act('dislike')">
                  <ThumbDownIcon />
                </IconButton>
                <IconButton variant="pill" label="Retry" :disabled="disabled" @click="act('retry')"><RefreshIcon /></IconButton>
                <MoreMenu v-if="moreActions?.length" :actions="moreActions" :disabled="disabled" @select="act($event.id)" />
              </div>
              <IconButton variant="round" label="Show details" :disabled="disabled" @click="flipped = true"><InfoIcon /></IconButton>
            </div>
          </div>
        </div>

        <div ref="back" class="chai-result-card__face chai-result-card__back" :aria-hidden="!flipped" :inert="!flipped">
          <button type="button" class="chai-result-card__close" aria-label="Close details" @click="flipped = false">
            <CloseIcon />
          </button>
          <div class="chai-result-card__prompt-box">
            <p class="chai-result-card__prompt-text">{{ prompt }}</p>
            <button
              type="button"
              class="chai-result-card__copy"
              :aria-label="copied ? 'Copied' : 'Copy prompt'"
              :title="copied ? 'Copied' : 'Copy prompt'"
              @click="copyPrompt"
            >
              <CheckIcon v-if="copied" /><CopyIcon v-else />
            </button>
          </div>
          <div class="chai-result-card__chips">
            <span v-for="(chip, i) in chips" :key="i" class="chai-result-card__chip">{{ chip }}</span>
            <!-- The builder's own backend checks: pass green with a check, fail red with a cross, so the verdict never relies on color alone. -->
            <span
              v-for="evaluation in result.evaluations"
              :key="evaluation.id"
              :class="[
                'chai-result-card__chip chai-result-card__chip--evaluation',
                `chai-result-card__chip--${evaluation.passed ? 'passed' : 'failed'}`,
              ]"
              :title="`${evaluation.label}: ${evaluation.passed ? 'passed' : 'failed'}`"
            >
              <CheckIcon v-if="evaluation.passed" /><CloseIcon v-else />{{ evaluation.label
              }}<span class="chai-visually-hidden">{{ evaluation.passed ? ", passed" : ", failed" }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- The expanded view is the card's sibling, not its child: the card's
         `perspective` (for the flip) would make a nested `position: fixed`
         overlay cover only the card. The expanded video is a second element;
         `videoTime` and `videoWasPlaying` carry its place across. -->
    <div
      v-if="mediaExpanded && result.output && overMedia"
      ref="overlay"
      class="chai-result-card__expand-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="kind === 'video' ? 'Expanded video' : 'Expanded image'"
      @keydown="onOverlayKeydown"
    >
      <div class="chai-result-card__expand-scrim" role="presentation" @click="mediaExpanded = false" />
      <div class="chai-result-card__expand-frame">
        <VideoPlayer
          v-if="kind === 'video'"
          :src="result.output.src"
          expanded
          :time="videoTime"
          :was-playing="videoWasPlaying"
          @playing-change="videoWasPlaying = $event"
        />
        <img v-else class="chai-result-card__image" :src="result.output.src" :alt="alt" />
        <button type="button" class="chai-result-card__collapse" aria-label="Collapse" @click="mediaExpanded = false">
          <CloseIcon />
        </button>
      </div>
    </div>
  </template>
</template>
