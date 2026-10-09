<script setup lang="ts">
/**
 * The compose bar for generative AI input: prompt field, attachments, use
 * case, model and aspect-ratio menus, Enhance, and submit, all driven by
 * which props are given. Same props as React's `Composer`, with `v-model`
 * for the prompt and `v-model:…` for attachments, use cases, models, aspect
 * ratio, auto-select and regions.
 *
 * Some controls show only with somewhere for them to go, so these listeners
 * are props, checked for: `@update:attachments` (add and remove media),
 * `@update:model-id` / `@update:model-ids` (the Model menu),
 * `@update:aspect-ratio`, `@update:use-cases` and `@clear-use-case` (chip
 * remove), `@update:regions`, `@enhance` (the Enhance button), `@abort` (stop
 * while submitting) and `@attach-menu-select` (the + menu's use cases).
 */
import "@material/web/fab/fab.js";
import { computed, onScopeDispose, ref, watch } from "vue";
import {
  composerAttachmentsFromFiles,
  composerAttachMenuItems,
  composerView,
  enhanceRevealDurationMs,
  MAX_ANIMATE_ENHANCE_LENGTH,
  type ComposerAttachment,
  type ComposerAttachMenuAction,
  type ComposerSubmitPayload,
  type ComposerUseCase,
  type EditRegion,
  type MediaKind,
  type ModelOption,
  type ParameterOption,
} from "@chai-ui/core";
import AttachMenu from "./composer/AttachMenu.vue";
import Chip from "./composer/Chip.vue";
import { ArrowForwardIcon, CloseSymbolIcon, ErrorIcon, ImageIcon, MusicNoteIcon, OptimizeIcon, RetryIcon, StopIcon, UndoIcon, VideocamIcon } from "./icons.js";
import SearchMenu from "./primitives/SearchMenu.vue";

const props = withDefaults(
  defineProps<{
    /** The prompt text. Controlled: use `v-model`. */
    modelValue: string;
    /** Defaults to "Describe media to create", or edit wording when the use case is an edit. */
    placeholder?: string;
    /** The prompt field's accessible name. Defaults to `placeholder`, which disappears once the person types. */
    promptLabel?: string;
    attachments?: ComposerAttachment[];
    "onUpdate:attachments"?: (next: ComposerAttachment[]) => void;
    /** The use-case chip. Aspect ratio only renders for an image or video use case. */
    useCase?: ComposerUseCase | null;
    onClearUseCase?: () => void;
    /** What a submit means with no use case picked. Defaults to `TEXT_USE_CASE`. Never shown as a chip. */
    defaultUseCase?: ComposerUseCase;
    /** Several use cases at once, at most one per kind, with `useCases` and `modelsByKind`. */
    multiSelectUseCases?: boolean;
    useCases?: ComposerUseCase[];
    "onUpdate:useCases"?: (next: ComposerUseCase[]) => void;
    /** Models per use-case kind, for `multiSelectUseCases`. A kind left out gets Chai's suggested models. */
    modelsByKind?: Partial<Record<MediaKind, ModelOption[]>>;
    /** The end user can pick several models, each producing its own result, with `modelIds`. */
    multiSelectModels?: boolean;
    modelIds?: string[];
    "onUpdate:modelIds"?: (ids: string[]) => void;
    /** Models for the use case. Leave out for Chai's suggested Fal models; `[]` for no Model menu. */
    models?: ModelOption[];
    modelId?: string | null;
    "onUpdate:modelId"?: (id: string | null) => void;
    /** The model is chosen at submit: `useComposer` asks the reasoning model. Turning it on clears the pick. */
    autoSelectModel?: boolean;
    /** An "Auto-select model" switch at the top of the Model menu, for the end user. */
    showAutoSelectToggle?: boolean;
    "onUpdate:autoSelectModel"?: (value: boolean) => void;
    /** Your own labels or a shorter list; ratios the models don't take are left out either way. */
    aspectRatios?: ParameterOption<string>[];
    aspectRatio?: string | null;
    "onUpdate:aspectRatio"?: (value: string) => void;
    /** Shows the Enhance button; your handler runs the rewrite and updates the prompt. Gets the current prompt. */
    onEnhance?: (value: string) => void;
    /** True while your Enhance handler is running. */
    enhancing?: boolean;
    /** The last submit's failure: submit becomes retry, and the message shows inline. */
    submitError?: string | null;
    /** Overrides the built-in "empty prompt and no attachments" check. Ignored while `submitError` is set. */
    submitDisabled?: boolean;
    /** True while a request is in flight: with `@abort`, submit becomes stop; without, it's disabled. */
    submitting?: boolean;
    onAbort?: () => void;
    onAttachMenuSelect?: (action: ComposerAttachMenuAction) => void;
    /** Which + menu items to show. Each still shows only when it can work. */
    attachMenuActions?: ComposerAttachMenuAction[];
    /** An edit's regions (from `useComposer`'s `edit`), shown as colored chips while editing. */
    regions?: EditRegion[];
    "onUpdate:regions"?: (next: EditRegion[]) => void;
    disabled?: boolean;
  }>(),
  {
    attachments: () => [],
    useCase: null,
    useCases: () => [],
    modelIds: () => [],
    modelId: null,
    aspectRatio: null,
    submitError: null,
    // Left undefined unless set: Vue would make an absent boolean `false`,
    // which reads as "never disable".
    submitDisabled: undefined,
    regions: () => [],
  }
);
const emit = defineEmits<{
  "update:modelValue": [value: string];
  /** Everything Composer tracks. Also what retry sends, with the same payload, when `submitError` is set. */
  submit: [payload: ComposerSubmitPayload];
  unsupportedFile: [fileName: string];
}>();

const view = computed(() =>
  composerView({
    ...props,
    value: props.modelValue,
    onModelChange: props["onUpdate:modelId"],
    onModelIdsChange: props["onUpdate:modelIds"],
  })
);
const menuItems = computed(() =>
  composerAttachMenuItems(props.attachMenuActions, {
    canAddMedia: Boolean(props["onUpdate:attachments"]),
    canSelect: Boolean(props.onAttachMenuSelect),
  })
);
const modelMenuOptions = computed(() =>
  props.multiSelectUseCases
    ? { sections: view.value.modelSections.map((s) => ({ label: s.label, options: s.options })) }
    : { options: view.value.modelSections[0]?.options }
);

// Auto-select chooses at submit, so turning it on clears the current pick
// and the trigger reads "Auto-select" until routing fills in the model.
watch(
  () => props.autoSelectModel,
  (on, was) => {
    if (!on || was) return;
    if (view.value.multiModel) props["onUpdate:modelIds"]?.([]);
    else props["onUpdate:modelId"]?.(null);
  }
);

// Auto-select belongs to the Model menu it was turned on in: picking
// another use case turns it off, so the new one's model is picked by hand.
// Only when the end user owns the switch; a builder's setting stays.
watch(
  () => view.value.useCaseKey,
  () => {
    if (props.autoSelectModel && props.showAutoSelectToggle) props["onUpdate:autoSelectModel"]?.(false);
  }
);

function toggleModel(id: string) {
  if (view.value.multiModel) props["onUpdate:modelIds"]?.(view.value.toggledModelIds(id));
  else props["onUpdate:modelId"]?.(id);
}

// Grows with wrapped text from one line, instead of a fixed row count.
const textarea = ref<HTMLTextAreaElement>();
watch(
  () => props.modelValue,
  () => {
    const el = textarea.value;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  },
  { flush: "post", immediate: true }
);

// Enhance and undo. The prompt already holds the rewrite once `enhancing`
// drops; the reveal is a decorative overlay painting it in, then gone.
const originalValue = ref<string | null>(null);
const enhancedValue = ref<string | null>(null);
const animatingText = ref<string | null>(null);
const revealedLength = ref(0);
let raf = 0;

watch(
  () => props.enhancing,
  (now, was) => {
    if (!was || now || originalValue.value == null || props.modelValue === originalValue.value) return;
    const value = props.modelValue;
    enhancedValue.value = value;
    // Long rewrites and reduced-motion requests appear at once.
    if (value.length > MAX_ANIMATE_ENHANCE_LENGTH || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    animatingText.value = value;
    revealedLength.value = 0;
    const duration = enhanceRevealDurationMs(value.length);
    const start = performance.now();
    const tick = (time: number) => {
      revealedLength.value = Math.min(value.length, Math.floor(((time - start) / duration) * value.length));
      if (revealedLength.value < value.length) raf = requestAnimationFrame(tick);
      else animatingText.value = null;
    };
    raf = requestAnimationFrame(tick);
  }
);
onScopeDispose(() => cancelAnimationFrame(raf));

const animating = computed(() => animatingText.value != null);
const isEnhanced = computed(() => !animating.value && enhancedValue.value != null && props.modelValue === enhancedValue.value);
const enhanceBusy = computed(() => Boolean(props.enhancing) || animating.value);

function onOptimizeClick() {
  if (isEnhanced.value) {
    const original = originalValue.value;
    enhancedValue.value = null;
    originalValue.value = null;
    if (original != null) emit("update:modelValue", original);
    return;
  }
  originalValue.value = props.modelValue; // for undo, before the rewrite lands
  props.onEnhance?.(props.modelValue);
}

async function onFiles(files: FileList | null) {
  const onAttachments = props["onUpdate:attachments"];
  if (!files || files.length === 0 || !onAttachments) return;
  // Edit mode works on one image: a new one replaces it, and the edit starts over.
  const { attachments, unsupported } = await composerAttachmentsFromFiles(files, props.attachments, view.value.editing);
  unsupported.forEach((name) => emit("unsupportedFile", name));
  if (attachments) onAttachments(attachments);
}

function removeUseCase(useCase: ComposerUseCase) {
  if (props.multiSelectUseCases) props["onUpdate:useCases"]?.(props.useCases.filter((u) => u.kind !== useCase.kind));
  else props.onClearUseCase?.();
}

function onSubmitClick() {
  if (view.value.showStop) props.onAbort?.();
  else if (!view.value.isSubmitDisabled && !props.submitting) emit("submit", view.value.payload());
}
</script>

<template>
  <div class="chai-composer">
    <div v-if="attachments.length > 0" class="chai-composer__thumbnails">
      <div v-for="a in attachments" :key="a.id" class="chai-composer__thumb">
        <img v-if="a.kind === 'image'" class="chai-composer__thumb-img" :src="a.src" alt="" />
        <span v-else class="chai-composer__thumb-icon"><VideocamIcon v-if="a.kind === 'video'" /><MusicNoteIcon v-else-if="a.kind === 'audio'" /><ImageIcon v-else /></span>
        <button
          v-if="props['onUpdate:attachments']"
          type="button"
          class="chai-composer__thumb-remove"
          aria-label="Remove attachment"
          @click="props['onUpdate:attachments']?.(attachments.filter((x) => x.id !== a.id))"
        >
          <CloseSymbolIcon />
        </button>
      </div>
    </div>

    <ul v-if="view.editing && regions.length > 0" class="chai-composer__regions" aria-label="Edit regions">
      <li v-for="r in regions" :key="r.id">
        <Chip
          :label="`Region ${r.number}`"
          :region-number="r.number"
          :removable="Boolean(props['onUpdate:regions'])"
          :disabled="disabled"
          @remove="props['onUpdate:regions']?.(regions.filter((x) => x.id !== r.id))"
        />
      </li>
    </ul>

    <div class="chai-composer__field">
      <textarea
        ref="textarea"
        :class="['chai-composer__input chai-composer__type', { 'chai-composer__input--revealing': animating }]"
        :value="modelValue"
        :placeholder="view.placeholder"
        :aria-label="promptLabel ?? view.placeholder"
        rows="1"
        :disabled="disabled || animating"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
      <!-- The Enhance reveal: decorative, so hidden from screen readers, which read the textarea's final text. -->
      <div v-if="animating" class="chai-composer__reveal chai-composer__type" aria-hidden="true">
        <span class="chai-composer__reveal-text">{{ animatingText!.slice(0, revealedLength) }}</span>
      </div>
      <!-- Optimize, or once a rewrite lands, undo it: until the prompt is edited by hand. -->
      <button
        v-if="onEnhance"
        type="button"
        :class="['chai-composer__optimize', { 'chai-composer__optimize--active': enhanceBusy }]"
        :disabled="disabled || (isEnhanced ? false : !modelValue.trim() || enhanceBusy)"
        :aria-label="isEnhanced ? 'Revert to original prompt' : 'Optimize prompt'"
        :title="isEnhanced ? 'Revert to original prompt' : 'Optimize prompt'"
        @click="onOptimizeClick"
      >
        <UndoIcon v-if="isEnhanced" /><OptimizeIcon v-else />
      </button>
    </div>

    <p v-if="submitError" class="chai-composer__error" role="alert"><ErrorIcon />{{ submitError }}</p>

    <div class="chai-composer__controls">
      <div class="chai-composer__controls-start">
        <AttachMenu
          v-if="menuItems.length > 0"
          :items="menuItems"
          :images-only="view.editing"
          :disabled="disabled"
          @select="onAttachMenuSelect?.($event)"
          @files="onFiles"
        />

        <Chip
          v-for="u in view.pickedUseCases"
          :key="u.kind"
          :label="u.label"
          :removable="Boolean(multiSelectUseCases ? props['onUpdate:useCases'] : onClearUseCase)"
          :disabled="disabled"
          @remove="removeUseCase(u)"
        />

        <!-- The auto-select switch lives inside the Model menu, so with it shown the trigger stays enabled: it's the only way back to the switch. -->
        <SearchMenu
          v-if="view.modelSections.length > 0 && view.canPickModel"
          v-bind="modelMenuOptions"
          :value="view.multiModel ? view.pickedModelIds : modelId"
          :multiple="view.multiModel"
          :toggle-header="
            showAutoSelectToggle
              ? { label: 'Auto-select model', value: autoSelectModel, onChange: (v: boolean) => props['onUpdate:autoSelectModel']?.(v) }
              : undefined
          "
          :trigger-label="view.modelTriggerLabel"
          :menu-label="view.multiModel ? 'Select models' : 'Select model'"
          :searchable="false"
          trigger-variant="text"
          :disabled="disabled || (autoSelectModel && !showAutoSelectToggle)"
          :panel-width="showAutoSelectToggle ? 320 : undefined"
          @select="toggleModel($event.id)"
        />

        <SearchMenu
          v-if="view.showAspectRatio && view.aspectOptions.length > 0 && props['onUpdate:aspectRatio']"
          :options="view.aspectOptions.map((o) => ({ id: o.value, label: o.label }))"
          :value="view.offeredAspect"
          :trigger-label="view.selectedAspect?.label ?? 'Aspect ratio'"
          menu-label="Aspect ratio"
          :searchable="false"
          trigger-variant="text"
          :disabled="disabled"
          @select="props['onUpdate:aspectRatio']?.($event.id)"
        />
      </div>

      <!-- MD3's md-fab has no disabled state of its own; Chai's unfilled-until-ready look comes from `data-ready` in style.css. `label=""` keeps it a plain icon FAB. -->
      <md-fab
        class="chai-composer__submit"
        size="small"
        variant="secondary"
        label=""
        :data-ready="view.showStop || !view.isSubmitDisabled || undefined"
        :data-error="Boolean(submitError) || undefined"
        :data-stop="view.showStop || undefined"
        :aria-label="view.showStop ? 'Stop' : submitError ? 'Retry' : 'Submit'"
        :aria-disabled="view.showStop ? 'false' : submitting || view.isSubmitDisabled ? 'true' : 'false'"
        @click="onSubmitClick"
      >
        <span slot="icon"><StopIcon v-if="view.showStop" /><RetryIcon v-else-if="submitError" /><ArrowForwardIcon v-else /></span>
      </md-fab>
    </div>
  </div>
</template>
