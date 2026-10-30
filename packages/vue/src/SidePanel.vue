<script setup lang="ts">
/**
 * A panel on one side of the page with the Composer and answers, for quick
 * model use without leaving the page. Questions can be about the page (with
 * `pageContext`) or about anything else. Same props as React's `SidePanel`,
 * with `v-model:open`, `@event`, and `#logo` and `#footer` slots.
 */
import { computed, nextTick, ref, useId, useSlots, watch } from "vue";
import {
  buildSidePanelPrompt,
  readPageContext,
  resultCardEvents,
  sidePanelAnswerText,
  sidePanelEvents,
  sidePanelHistory,
  sidePanelTextPayload,
  SIDE_PANEL_PAGE_PLACEHOLDER,
  SIDE_PANEL_PLACEHOLDER,
  type ChaiEvent,
  type ComposerSubmitPayload,
  type GenerationEngine,
  type PageContext,
  type SidePanelThreadTurn,
  type VoiceInputConfig,
} from "@chai-ui/core";
import Composer from "./Composer.vue";
import ResultCard from "./ResultCard.vue";
import SimpleAnswer from "./side-panel/SimpleAnswer.vue";
import type { ResultCardVote } from "./result-card/types.js";
import { useComposer } from "./useComposer.js";
import { CloseSymbolIcon, NewChatIcon, PageIcon, SparkleIcon } from "./icons.js";

const props = withDefaults(
  defineProps<{
    /** The assistant's name: the greeting's heading, then the header once a conversation starts. */
    title: string;
    /** One line under the greeting. */
    description?: string;
    /** Which edge of the page the panel sits on. */
    side?: "right" | "left";
    /** `"push"` (default) takes its own width beside your content, so place it as a flex sibling of your page. `"overlay"` floats over the page. Below 600px wide, both open as a full-screen sheet. */
    mode?: "push" | "overlay";
    /** The overlay and launcher position inside the nearest positioned parent instead of the browser window. */
    contained?: boolean;
    /** Open state (`v-model:open`). Leave it out and the panel keeps its own, starting from `defaultOpen`. */
    open?: boolean;
    "onUpdate:open"?: (open: boolean) => void;
    defaultOpen?: boolean;
    /** The floating button that opens the panel. Turn it off to open the panel from your own button with `open`. */
    launcher?: boolean;
    /** Short example prompts in the empty state. A tap sends one. Include at least one that isn't about the page. */
    promptTips?: string[];
    promptTipsLabel?: string;
    /** Off by default. `true` reads the page (see `readPageContext`) and sends it with each question, shown as a removable chip; or pass a function to read it your own way. */
    pageContext?: boolean | (() => PageContext);
    pageContextLabel?: string;
    /** Defaults to "Ask about this page, or ask something else" with the page chip on, else "Ask anything". */
    placeholder?: string;
    /** `"simple"` (default): answers as text on the panel. `"card"`: each answer in a full ResultCard. */
    answers?: "simple" | "card";
    /** A short note under the Composer, e.g. a disclaimer. The `#footer` slot takes markup instead. */
    footer?: string;
    /** Dictation, as on the Composer. Off by default. */
    voiceInput?: VoiceInputConfig;
    /** The engine for answers. Defaults to the `ChaiProvider`'s reasoning engine. */
    textEngine?: GenerationEngine;
    textModel?: string;
    /** Front-end analytics (`@event`) from the panel, its Composer and its answers, one `ChaiEvent` each. */
    onEvent?: (event: ChaiEvent) => void;
  }>(),
  {
    side: "right",
    mode: "push",
    open: undefined,
    launcher: true,
    promptTips: () => [],
    promptTipsLabel: "Getting started",
    pageContext: false,
    pageContextLabel: "This page",
    answers: "simple",
  }
);
const slots = useSlots();

let turnCounter = 0;
const openState = ref(props.defaultOpen);
const isOpen = computed(() => props.open ?? openState.value);
const value = ref("");
const turns = ref<SidePanelThreadTurn[]>([]);
// Page context is on per question: the person can take the chip off to ask something else.
const pageOn = ref(true);
const votes = ref<Record<string, ResultCardVote>>({});
const composer = useComposer(() => ({ textEngine: props.textEngine, textModel: props.textModel }));
const body = ref<HTMLElement>();
const headingId = useId();

const usePage = computed(() => Boolean(props.pageContext) && pageOn.value);
const live = computed(() => composer.run.value?.results ?? []);
const busy = computed(() => live.value.some((r) => r.status === "queued" || r.status === "running"));
const shown = computed(() =>
  turns.value.map((t, i) => (i === turns.value.length - 1 && composer.run.value ? { ...t, results: live.value } : t))
);
const conversation = computed(() => turns.value.length > 0);
const hasFooter = computed(() => Boolean(props.footer || slots.footer));

// Follow the newest answer as it streams in, and once more when it ends
// and its actions appear below it.
watch(
  () => [turns.value.length, sidePanelAnswerText(live.value[0]), live.value[0]?.status],
  async () => {
    await nextTick();
    if (body.value) body.value.scrollTop = body.value.scrollHeight;
  }
);

function reset() {
  composer.cancel();
  turns.value = [];
  votes.value = {};
  value.value = "";
  pageOn.value = true;
}

function setOpen(next: boolean) {
  props.onEvent?.(next ? sidePanelEvents.opened() : sidePanelEvents.closed(turns.value.length));
  if (!next) reset();
  if (props.open === undefined) openState.value = next;
  props["onUpdate:open"]?.(next);
}

function newChat() {
  props.onEvent?.(sidePanelEvents.newChat(turns.value.length));
  reset();
}

function readPage(): PageContext {
  return typeof props.pageContext === "function" ? props.pageContext() : readPageContext();
}

/** Asks `prompt` after the `earlier` turns, with the page when `withPage`. */
function send(prompt: string, withPage: boolean, earlier: SidePanelThreadTurn[], payload?: ComposerSubmitPayload) {
  const full = buildSidePanelPrompt({ prompt, page: withPage ? readPage() : null, history: sidePanelHistory(earlier) });
  turns.value = [...earlier, { id: `turn-${++turnCounter}`, prompt, withPage, results: [] }];
  composer.submit(payload ? { ...payload, value: full } : sidePanelTextPayload(full));
}

function ask(prompt: string, payload?: ComposerSubmitPayload) {
  const text = prompt.trim();
  if (!text || busy.value) return;
  value.value = "";
  send(text, usePage.value, shown.value, payload);
}

function useTip(tip: string, index: number) {
  props.onEvent?.(sidePanelEvents.tipUsed(index));
  ask(tip);
}

// Only the newest answer can be retried: it's the one the store holds.
function retry(turn: SidePanelThreadTurn) {
  send(turn.prompt, turn.withPage, shown.value.slice(0, -1));
}

function vote(turnId: string, v: "like" | "dislike") {
  votes.value = { ...votes.value, [turnId]: votes.value[turnId] === v ? null : v };
}

function simpleAction(turn: SidePanelThreadTurn, action: "like" | "dislike" | "retry" | "copy") {
  props.onEvent?.(resultCardEvents.action(action));
  if (action === "like" || action === "dislike") vote(turn.id, action);
  else if (action === "retry") retry(turn);
}

// ResultCard reports its own action events.
function cardAction(turn: SidePanelThreadTurn, newest: boolean, action: string) {
  if (action === "like" || action === "dislike") vote(turn.id, action);
  else if (action === "retry" && newest) retry(turn);
}

function setPage(on: boolean) {
  props.onEvent?.(sidePanelEvents.pageContextToggled(on));
  pageOn.value = on;
}

const composerProps = computed(() => ({
  placeholder: props.placeholder ?? (usePage.value ? SIDE_PANEL_PAGE_PLACEHOLDER : SIDE_PANEL_PLACEHOLDER),
  models: [],
  submitting: busy.value,
  onAbort: composer.cancel,
  voiceInput: props.voiceInput,
  onEvent: props.onEvent,
  contextChips: usePage.value
    ? [{ id: "page", label: props.pageContextLabel, icon: PageIcon, onRemove: () => setPage(false) }]
    : [],
  extraMenuItems:
    props.pageContext && !pageOn.value
      ? [{ id: "page", label: `Use ${props.pageContextLabel.toLowerCase()}`, icon: PageIcon, onSelect: () => setPage(true) }]
      : [],
}));
</script>

<template>
  <button
    v-if="!isOpen && launcher"
    type="button"
    :class="['chai-side-panel__launcher', `chai-side-panel__launcher--${side}`, { 'chai-side-panel__launcher--contained': contained }]"
    :aria-label="`Open ${title}`"
    :title="`Open ${title}`"
    @click="setOpen(true)"
  >
    <slot name="logo"><SparkleIcon /></slot>
  </button>
  <aside
    v-else-if="isOpen"
    :class="['chai-side-panel', `chai-side-panel--${side}`, `chai-side-panel--${mode}`, { 'chai-side-panel--contained': contained }]"
    :aria-labelledby="headingId"
    data-chai-page-context="skip"
  >
    <div :class="['chai-side-panel__head', { 'chai-side-panel__head--divided': conversation }]">
      <div v-if="conversation" class="chai-side-panel__title">
        <span class="chai-side-panel__logo"><slot name="logo"><SparkleIcon /></slot></span>
        <h2 :id="headingId" class="chai-side-panel__title-text">{{ title }}</h2>
      </div>
      <div class="chai-side-panel__actions">
        <button v-if="conversation" type="button" class="chai-side-panel__icon-btn" aria-label="New chat" title="New chat" @click="newChat">
          <NewChatIcon />
        </button>
        <button type="button" class="chai-side-panel__icon-btn" aria-label="Close" title="Close" @click="setOpen(false)">
          <CloseSymbolIcon />
        </button>
      </div>
    </div>

    <div ref="body" class="chai-side-panel__body">
      <div v-if="conversation" class="chai-side-panel__thread">
        <div v-for="(turn, i) in shown" :key="turn.id" class="chai-side-panel__turn">
          <span v-if="turn.withPage" class="chai-side-panel__sent-with"><PageIcon />With {{ pageContextLabel.toLowerCase() }}</span>
          <p class="chai-side-panel__prompt">{{ turn.prompt }}</p>
          <template v-if="answers === 'card'">
            <ResultCard
              v-if="turn.results[0]"
              :results="turn.results"
              :prompt="turn.prompt"
              :get-vote="() => votes[turn.id] ?? null"
              :on-event="onEvent"
              @action="(action: string) => cardAction(turn, i === shown.length - 1, action)"
            />
          </template>
          <SimpleAnswer
            v-else
            :result="turn.results[0]"
            :vote="votes[turn.id] ?? null"
            :can-retry="i === shown.length - 1"
            @action="(action) => simpleAction(turn, action)"
          />
        </div>
      </div>
      <div v-else class="chai-side-panel__empty">
        <div class="chai-side-panel__hello">
          <span class="chai-side-panel__logo chai-side-panel__logo--large"><slot name="logo"><SparkleIcon /></slot></span>
          <h2 :id="headingId" class="chai-side-panel__heading">{{ title }}</h2>
          <p v-if="description" class="chai-side-panel__description">{{ description }}</p>
        </div>
        <Composer v-model="value" v-bind="composerProps" menu-placement="below" @submit="(p: ComposerSubmitPayload) => ask(p.value, p)" />
        <div v-if="promptTips.length > 0" class="chai-side-panel__tips" role="group" :aria-label="promptTipsLabel">
          <span class="chai-side-panel__tips-label">{{ promptTipsLabel }}</span>
          <button v-for="(tip, index) in promptTips" :key="tip" type="button" class="chai-side-panel__tip" @click="useTip(tip, index)">
            {{ tip }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="conversation || hasFooter" class="chai-side-panel__dock">
      <Composer
        v-if="conversation"
        v-model="value"
        v-bind="composerProps"
        menu-placement="above"
        @submit="(p: ComposerSubmitPayload) => ask(p.value, p)"
      />
      <p v-if="hasFooter" class="chai-side-panel__footer"><slot name="footer">{{ footer }}</slot></p>
    </div>
  </aside>
</template>
