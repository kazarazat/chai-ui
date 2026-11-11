<script setup lang="ts">
/**
 * An agent's reply with an interactive element in it: a call-to-action
 * button, approve or decline, a form, single or multiple choice, choice
 * cards, or a media request. It locks once answered and keeps a short label
 * of what the person did ("You clicked Cancel"). Same markup and classes as
 * the React component.
 */
import { computed, onMounted, ref, useId } from "vue";
import {
  acceptInteractiveFiles,
  interactiveAnswerLabel,
  interactiveChoiceReady,
  interactiveDeclineLabel,
  interactiveFormReady,
  interactiveMediaAccept,
  interactiveMediaHint,
  interactiveOtherLabel,
  interactiveResponseEvents,
  interactiveSubmitLabel,
  nextInteractiveSelection,
  INTERACTIVE_OTHER_ID,
  type ChaiEvent,
  type InteractiveAnswer,
  type InteractiveElement,
} from "@chai-ui/core";
import SearchMenu from "./primitives/SearchMenu.vue";
import { CheckIcon, CloseSymbolIcon, MixedMediaIcon } from "./icons.js";

const props = defineProps<{
  /** The agent's words above the element. */
  text?: string;
  /** What to draw: an action, a form, a choice or a media request. */
  element: InteractiveElement;
  /** The answer, once there is one: pass a saved answer to show it locked after a reload. */
  answer?: InteractiveAnswer | null;
  /** Called once, when the person answers (`@answer`). Send it on to your agent. */
  onAnswer?: (answer: InteractiveAnswer) => void;
  /** Analytics (`@event`): the element shown, and answered (kinds and counts only). */
  onEvent?: (event: ChaiEvent) => void;
}>();

const own = ref<InteractiveAnswer | null>(null);
const locked = computed(() => props.answer ?? own.value);
const id = useId();

onMounted(() => {
  // Shown once, when it first appears unanswered (not when a saved thread reloads).
  if (!locked.value) props.onEvent?.(interactiveResponseEvents.shown(props.element));
});

function submit(next: InteractiveAnswer) {
  if (locked.value) return;
  own.value = next;
  props.onEvent?.(interactiveResponseEvents.answered(props.element, next));
  props.onAnswer?.(next);
}

// Action
const decision = computed(() => (locked.value?.type === "action" ? locked.value.decision : null));

// Form
const values = ref<Record<string, string>>({});
const shownValues = computed(() => (locked.value?.type === "form" ? locked.value.values : values.value));
const formReady = computed(() => props.element.type === "form" && interactiveFormReady(props.element, values.value));
function sendForm() {
  if (formReady.value) submit({ type: "form", values: { ...values.value } });
}

// Choice
const selected = ref<string[]>([]);
const other = ref("");
const shownSelected = computed(() => (locked.value?.type === "choice" ? locked.value.selected : selected.value));
const shownOther = computed(() => (locked.value?.type === "choice" ? (locked.value.other ?? "") : other.value));
const choiceReady = computed(() => interactiveChoiceReady(selected.value, other.value));
const listOptions = computed(() =>
  props.element.type === "choice"
    ? [
        ...props.element.options,
        ...(props.element.allowOther ? [{ id: INTERACTIVE_OTHER_ID, label: interactiveOtherLabel(props.element), description: undefined }] : []),
      ]
    : []
);
function pick(optionId: string) {
  if (locked.value || props.element.type !== "choice") return;
  selected.value = nextInteractiveSelection(props.element, selected.value, optionId);
}
function sendChoice() {
  if (!choiceReady.value) return;
  const next: InteractiveAnswer = { type: "choice", selected: [...selected.value] };
  if (selected.value.includes(INTERACTIVE_OTHER_ID)) next.other = other.value.trim();
  submit(next);
}

// Media
const fileInput = ref<HTMLInputElement>();
const files = ref<File[]>([]);
const dragging = ref(false);
const shownFiles = computed(() => (locked.value?.type === "media" ? locked.value.files.map((f) => f.name) : files.value.map((f) => f.name)));
function addFiles(list: FileList | null | undefined) {
  if (!list || props.element.type !== "media") return;
  files.value = acceptInteractiveFiles(props.element, [...files.value, ...Array.from(list)]);
}
function onDrop(e: DragEvent) {
  dragging.value = false;
  addFiles(e.dataTransfer?.files);
}
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  addFiles(input.files);
  input.value = "";
}
</script>

<template>
  <div :class="['chai-interactive', { 'chai-interactive--locked': locked }]">
    <div v-if="text" class="chai-interactive__text">{{ text }}</div>
    <div class="chai-interactive__body">
      <!-- Action -->
      <div v-if="element.type === 'action'" class="chai-interactive__actions">
        <button
          v-if="element.confirm"
          type="button"
          :class="['chai-btn chai-btn--outlined', { 'chai-interactive__picked': decision === 'declined' }]"
          :disabled="Boolean(locked)"
          @click="submit({ type: 'action', decision: 'declined' })"
        >
          {{ interactiveDeclineLabel(element) }}
        </button>
        <button
          type="button"
          :class="['chai-btn chai-interactive__primary', { 'chai-interactive__picked': decision === 'accepted' }]"
          :disabled="Boolean(locked)"
          @click="submit({ type: 'action', decision: 'accepted' })"
        >
          {{ element.label }}
        </button>
      </div>

      <!-- Form -->
      <form v-else-if="element.type === 'form'" class="chai-interactive__form" @submit.prevent="sendForm">
        <div v-for="field in element.fields" :key="field.id" class="chai-interactive__field">
          <label :for="`${id}-${field.id}`" class="chai-interactive__label">
            {{ field.label }}<span v-if="field.required" aria-hidden="true"> *</span>
          </label>
          <textarea
            v-if="field.kind === 'textarea'"
            :id="`${id}-${field.id}`"
            class="chai-interactive__input"
            rows="3"
            :value="shownValues[field.id] ?? ''"
            :required="field.required"
            :disabled="Boolean(locked)"
            :placeholder="locked ? undefined : field.placeholder"
            @input="values = { ...values, [field.id]: ($event.target as HTMLTextAreaElement).value }"
          />
          <!-- The same dropdown as the Composer's and Media analyzer's menus. -->
          <div
            v-else-if="field.kind === 'select'"
            :class="['chai-interactive__select', { 'chai-interactive__select--empty': !shownValues[field.id] }]"
          >
            <SearchMenu
              :trigger-id="`${id}-${field.id}`"
              :options="(field.options ?? []).map((o) => ({ id: o, label: o }))"
              :value="shownValues[field.id] ?? null"
              :trigger-label="shownValues[field.id] || (locked ? '' : field.placeholder || 'Choose')"
              :menu-label="field.label"
              :searchable="false"
              :disabled="Boolean(locked)"
              @select="values = { ...values, [field.id]: $event.id }"
            />
          </div>
          <input
            v-else
            :id="`${id}-${field.id}`"
            class="chai-interactive__input"
            :type="field.kind ?? 'text'"
            :value="shownValues[field.id] ?? ''"
            :required="field.required"
            :disabled="Boolean(locked)"
            :placeholder="locked ? undefined : field.placeholder"
            @input="values = { ...values, [field.id]: ($event.target as HTMLInputElement).value }"
          />
        </div>
        <div v-if="!locked" class="chai-interactive__actions">
          <button type="submit" class="chai-btn chai-interactive__primary" :disabled="!formReady">
            {{ interactiveSubmitLabel(element) }}
          </button>
        </div>
      </form>

      <!-- Choice -->
      <div v-else-if="element.type === 'choice'" class="chai-interactive__choice">
        <div v-if="element.display === 'cards'" class="chai-interactive__cards" role="group">
          <button
            v-for="o in element.options"
            :key="o.id"
            type="button"
            :class="['chai-interactive__card', { 'chai-interactive__card--selected': shownSelected.includes(o.id) }]"
            :aria-pressed="shownSelected.includes(o.id)"
            :disabled="Boolean(locked)"
            @click="pick(o.id)"
          >
            <img v-if="o.image" :src="o.image" alt="" class="chai-interactive__card-image" />
            <span class="chai-interactive__card-label">{{ o.label }}</span>
            <span v-if="o.description" class="chai-interactive__description">{{ o.description }}</span>
            <span v-if="shownSelected.includes(o.id)" class="chai-interactive__card-check" aria-hidden="true"><CheckIcon /></span>
          </button>
        </div>
        <div v-else class="chai-interactive__options" :role="element.multiple ? 'group' : 'radiogroup'">
          <label v-for="o in listOptions" :key="o.id" class="chai-interactive__option">
            <!-- Locked without `disabled`: browsers gray out a disabled input, the chosen one included. -->
            <input
              :type="element.multiple ? 'checkbox' : 'radio'"
              :name="id"
              :checked="shownSelected.includes(o.id)"
              :aria-disabled="locked ? true : undefined"
              :tabindex="locked ? -1 : undefined"
              @change="pick(o.id)"
            />
            <span class="chai-interactive__option-text">
              <span>{{ o.label }}</span>
              <span v-if="o.description" class="chai-interactive__description">{{ o.description }}</span>
            </span>
          </label>
          <input
            v-if="element.allowOther && shownSelected.includes(INTERACTIVE_OTHER_ID)"
            class="chai-interactive__input chai-interactive__other"
            :aria-label="interactiveOtherLabel(element)"
            placeholder="Type your answer"
            :value="shownOther"
            :disabled="Boolean(locked)"
            @input="other = ($event.target as HTMLInputElement).value"
            @keydown.enter="sendChoice"
          />
        </div>
        <div v-if="!locked" class="chai-interactive__actions">
          <button type="button" class="chai-btn chai-interactive__primary" :disabled="!choiceReady" @click="sendChoice">
            {{ interactiveSubmitLabel(element) }}
          </button>
        </div>
      </div>

      <!-- Media request -->
      <div v-else class="chai-interactive__media">
        <div
          v-if="!locked"
          :class="['chai-interactive__dropzone', { 'chai-interactive__dropzone--drag-active': dragging }]"
          role="button"
          tabindex="0"
          @click="fileInput?.click()"
          @keydown.enter.prevent="fileInput?.click()"
          @keydown.space.prevent="fileInput?.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <span class="chai-interactive__dropzone-icon" aria-hidden="true"><MixedMediaIcon /></span>
          <span class="chai-interactive__dropzone-hint">{{ interactiveMediaHint(element) }}</span>
          <input
            ref="fileInput"
            type="file"
            hidden
            :accept="interactiveMediaAccept(element)"
            :multiple="(element.max ?? 1) > 1"
            @change="onFileChange"
          />
        </div>
        <ul v-if="shownFiles.length > 0" class="chai-interactive__files">
          <li v-for="(fileName, i) in shownFiles" :key="`${fileName}-${i}`" class="chai-interactive__file">
            <span>{{ fileName }}</span>
            <button
              v-if="!locked"
              type="button"
              class="chai-interactive__file-remove"
              :aria-label="`Remove ${fileName}`"
              @click="files = files.filter((_, j) => j !== i)"
            >
              <CloseSymbolIcon />
            </button>
          </li>
        </ul>
        <div v-if="!locked" class="chai-interactive__actions">
          <button v-if="element.skipLabel" type="button" class="chai-btn chai-btn--outlined" @click="submit({ type: 'media', files: [] })">
            {{ element.skipLabel }}
          </button>
          <button
            type="button"
            class="chai-btn chai-interactive__primary"
            :disabled="files.length === 0"
            @click="submit({ type: 'media', files: files.map((file) => ({ name: file.name, file })) })"
          >
            {{ interactiveSubmitLabel(element) }}
          </button>
        </div>
      </div>

      <p v-if="locked" class="chai-interactive__answered" role="status">
        <CheckIcon />
        {{ interactiveAnswerLabel(element, locked) }}
      </p>
    </div>
  </div>
</template>
