<script setup lang="ts">
/**
 * Turns attached media into a prompt: a drop zone for images, a video or
 * audio, a model menu with auto-select, a prompt-length menu, and submit.
 * Pair with `useMediaAnalyzer`. Same props as React's `MediaAnalyzer`, with
 * `v-model:attachments`, `v-model:model-id`, `v-model:auto-select-model`
 * and `v-model:prompt-length`.
 */
import "@material/web/fab/fab.js";
import { computed, ref, watch } from "vue";
import {
  DEFAULT_MAX_ATTACHMENTS_BY_KIND,
  isMediaAnalyzerAtCap,
  mediaAnalyzerModelSections,
  nextMediaAnalyzerAttachments,
  PROMPT_LENGTH_HINT,
  readMediaFiles,
  replacedNote,
  SUGGESTED_ANALYSIS_MODELS,
  type MediaAnalysisPromptLength,
  type MediaAnalyzerAttachment,
  type MediaAnalyzerSubmitPayload,
  type MediaKind,
  type ModelOption,
} from "@chai-ui/core";
import { ArrowForwardIcon, AudioIcon, MixedMediaIcon, RemoveIcon, StopIcon, VideoIcon } from "./icons.js";
import SearchMenu from "./primitives/SearchMenu.vue";

const props = withDefaults(
  defineProps<{
    attachments: MediaAnalyzerAttachment[];
    maxAttachmentsByKind?: Record<MediaKind, number>;
    /** Fallback roster for a kind `modelsByKind` doesn't list. */
    models?: ModelOption[];
    /** Per-kind rosters; once a kind is attached, only its models show. Defaults to Chai's suggested OpenRouter models. */
    modelsByKind?: Partial<Record<MediaKind, ModelOption[]>>;
    /** The picked model. While `autoSelectModel` is on it's `null` until a submit routes, then the routed model. */
    modelId: string | null;
    /** The "Auto-select model" switch inside the model menu. Turning it on clears the pick. */
    autoSelectModel: boolean;
    /** `null` until a person picks one: the trigger says "Prompt length" rather than pre-filling a choice. */
    promptLength: MediaAnalysisPromptLength | null;
    promptLengthOptions: { value: MediaAnalysisPromptLength; label: string }[];
    disabled?: boolean;
    submitting?: boolean;
    submitError?: string | null;
    /** With a listener, submit turns into stop while `submitting` (wire it to `useMediaAnalyzer`'s `cancel`); without one, submit is just disabled. */
    onAbort?: () => void;
  }>(),
  { maxAttachmentsByKind: () => DEFAULT_MAX_ATTACHMENTS_BY_KIND, models: () => [], modelsByKind: () => SUGGESTED_ANALYSIS_MODELS }
);
const emit = defineEmits<{
  "update:attachments": [next: MediaAnalyzerAttachment[]];
  "update:modelId": [id: string | null];
  "update:autoSelectModel": [next: boolean];
  "update:promptLength": [value: MediaAnalysisPromptLength];
  unsupportedFile: [fileName: string];
  submit: [payload: MediaAnalyzerSubmitPayload];
}>();

const input = ref<HTMLInputElement>();
// A count, not a boolean: dragenter/dragleave fire for every child the
// pointer crosses too, so a boolean would flicker off over the icon or text.
const dragDepth = ref(0);
// What the last attach replaced (one kind per analysis), shown until the
// attachments change some other way. Matched by ids: a parent's ref hands
// the list back as a reactive copy, never the same array.
const replaced = ref<{ note: string; ids: string } | null>(null);
const idsOf = (list: MediaAnalyzerAttachment[]) => list.map((a) => a.id).join();

const kind = computed(() => props.attachments[0]?.kind);
const atCap = computed(() => isMediaAnalyzerAtCap(props.attachments, props.maxAttachmentsByKind));
const sections = computed(() => mediaAnalyzerModelSections(kind.value, props.modelsByKind, props.models));
// Looked up across every section, so a pick made before any media is attached still names itself on the trigger.
const selectedModel = computed(() => sections.value.flatMap((s) => s.options).find((m) => m.id === props.modelId));
const modelTriggerLabel = computed(
  () => selectedModel.value?.label ?? (props.autoSelectModel ? "Auto-select model" : "Select model")
);
const lengthOptions = computed(() =>
  // The clarifying suffix shows only in the list, never on the trigger.
  props.promptLengthOptions.map((o) => ({ id: o.value, label: o.label, rowLabel: `${o.label} (${PROMPT_LENGTH_HINT[o.value]})` }))
);
const lengthLabel = computed(() => props.promptLengthOptions.find((o) => o.value === props.promptLength)?.label ?? "Prompt length");
const isSubmitDisabled = computed(() => props.disabled || props.attachments.length === 0);
const showStop = computed(() => Boolean(props.submitting && props.onAbort));

// Auto-select chooses at submit, so turning it on clears the current pick
// and the trigger says what will happen until it does.
watch(
  () => props.autoSelectModel,
  (on, was) => {
    if (on && !was) emit("update:modelId", null);
  }
);

/** Reads every file first, then applies them in drop order and commits once. */
async function handleFiles(files: FileList | null | undefined) {
  if (!files || files.length === 0) return;
  const { media, unsupported } = await readMediaFiles(files);
  unsupported.forEach((name) => emit("unsupportedFile", name));
  if (media.length === 0) return;
  const next = media.reduce((acc, m) => nextMediaAnalyzerAttachments(acc, m, props.maxAttachmentsByKind), props.attachments);
  const note = replacedNote(props.attachments, next);
  replaced.value = note ? { note, ids: idsOf(next) } : null;
  emit("update:attachments", next);
}

function onDrop(e: DragEvent) {
  dragDepth.value = 0;
  if (!props.disabled) void handleFiles(e.dataTransfer?.files);
}

function onFileChange(e: Event) {
  const el = e.target as HTMLInputElement;
  void handleFiles(el.files);
  el.value = "";
}

function remove(id: string) {
  emit(
    "update:attachments",
    props.attachments.filter((a) => a.id !== id)
  );
}

function onSubmitClick() {
  if (showStop.value) props.onAbort?.();
  else if (!isSubmitDisabled.value && !props.submitting) {
    emit("submit", {
      attachments: props.attachments,
      modelId: props.modelId,
      autoSelectModel: props.autoSelectModel,
      models: kind.value ? (props.modelsByKind[kind.value] ?? props.models) : [],
      promptLength: props.promptLength,
    });
  }
}
</script>

<template>
  <div class="chai-media-analyzer">
    <div
      :class="[
        'chai-media-analyzer__dropzone',
        { 'chai-media-analyzer__dropzone--disabled': atCap, 'chai-media-analyzer__dropzone--drag-active': dragDepth > 0 },
      ]"
      @dragenter.prevent="dragDepth++"
      @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <span class="chai-media-analyzer__dropzone-icon" aria-hidden="true"><MixedMediaIcon /></span>
      <!-- `atCap` is only ever true for image. -->
      <p class="chai-media-analyzer__dropzone-hint">{{ atCap ? "Maximum images added" : "Add media to convert to prompt" }}</p>
      <button type="button" class="chai-chip-button" :disabled="disabled" @click="input?.click()">Select files</button>
      <input ref="input" type="file" accept="image/*,video/*,audio/*" multiple hidden :disabled="disabled" @change="onFileChange" />
    </div>

    <div v-if="attachments.length > 0" class="chai-media-analyzer__thumbnails">
      <div v-for="a in attachments" :key="a.id" class="chai-media-analyzer__thumb">
        <img v-if="a.kind === 'image'" class="chai-media-analyzer__thumb-img" :src="a.src" alt="" />
        <span v-else class="chai-media-analyzer__thumb-icon"><VideoIcon v-if="a.kind === 'video'" /><AudioIcon v-else /></span>
        <button type="button" class="chai-media-analyzer__thumb-remove" :aria-label="`Remove ${a.name ?? a.kind}`" @click="remove(a.id)">
          <RemoveIcon />
        </button>
      </div>
    </div>

    <p v-if="replaced && replaced.ids === idsOf(attachments)" class="chai-media-analyzer__note" role="status">{{ replaced.note }}</p>
    <p v-if="submitError" class="chai-media-analyzer__error" role="alert">{{ submitError }}</p>

    <div class="chai-media-analyzer__controls">
      <div class="chai-media-analyzer__controls-start">
        <SearchMenu
          :options="sections.length === 1 ? sections[0]!.options : undefined"
          :sections="sections.length > 1 ? sections : undefined"
          :toggle-header="{ label: 'Auto-select model', value: autoSelectModel, onChange: (next) => emit('update:autoSelectModel', next) }"
          :value="modelId"
          :trigger-label="modelTriggerLabel"
          menu-label="Select model"
          :searchable="false"
          trigger-variant="text"
          :disabled="disabled"
          :panel-width="320"
          @select="emit('update:modelId', $event.id)"
        />
        <SearchMenu
          :options="lengthOptions"
          :value="promptLength"
          :trigger-label="lengthLabel"
          menu-label="Prompt length"
          :searchable="false"
          trigger-variant="text"
          :disabled="disabled"
          @select="emit('update:promptLength', $event.id as MediaAnalysisPromptLength)"
        />
      </div>

      <!-- The same unfilled-until-ready submit as Composer's FAB. -->
      <md-fab
        class="chai-media-analyzer__submit"
        size="small"
        variant="secondary"
        label=""
        :data-ready="showStop || !isSubmitDisabled || undefined"
        :data-error="Boolean(submitError) || undefined"
        :data-stop="showStop || undefined"
        :aria-label="showStop ? 'Stop' : submitError ? 'Retry' : 'Analyze media'"
        :aria-disabled="showStop ? 'false' : submitting || isSubmitDisabled ? 'true' : 'false'"
        @click="onSubmitClick"
      >
        <span slot="icon"><StopIcon v-if="showStop" /><ArrowForwardIcon v-else /></span>
      </md-fab>
    </div>
  </div>
</template>
