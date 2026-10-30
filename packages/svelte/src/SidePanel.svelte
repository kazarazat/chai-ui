<script lang="ts">
  /**
   * A panel on one side of the page with the Composer and answers, for quick
   * model use without leaving the page. Questions can be about the page (with
   * `pageContext`) or about anything else. Same props as React's
   * `SidePanel`, with `logo` and `footer` as snippets.
   */
  import { tick, type Snippet } from "svelte";
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
  import Composer from "./Composer.svelte";
  import Icon from "./Icon.svelte";
  import ResultCard from "./ResultCard.svelte";
  import SimpleAnswer from "./side-panel/SimpleAnswer.svelte";
  import type { ResultCardVote } from "./result-card/types.js";
  import { useComposer } from "./useComposer.svelte.js";
  import { CloseSymbolIcon, NewChatIcon, PageIcon, SparkleIcon } from "./icons.js";

  interface SidePanelProps {
    /** The assistant's name: the greeting's heading, then the header once a conversation starts. */
    title: string;
    /** One line under the greeting. */
    description?: string;
    /** Your mark, about 44px in the greeting and 28px in the header. Defaults to a sparkle. */
    logo?: Snippet;
    /** Which edge of the page the panel sits on. */
    side?: "right" | "left";
    /** `"push"` (default) takes its own width beside your content, so place it as a flex sibling of your page. `"overlay"` floats over the page. Below 600px wide, both open as a full-screen sheet. */
    mode?: "push" | "overlay";
    /** The overlay and launcher position inside the nearest positioned parent instead of the browser window. */
    contained?: boolean;
    /** Controlled open state. Leave it out and the panel keeps its own, starting from `defaultOpen`. */
    open?: boolean;
    defaultOpen?: boolean;
    /** Fires on the launcher and on Close. Closing clears the conversation. */
    onOpenChange?: (open: boolean) => void;
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
    /** A short note under the Composer, e.g. a disclaimer: text, or a snippet for markup. */
    footer?: string | Snippet;
    /** Dictation, as on the Composer. Off by default. */
    voiceInput?: VoiceInputConfig;
    /** The engine for answers. Defaults to the `ChaiProvider`'s reasoning engine. */
    textEngine?: GenerationEngine;
    textModel?: string;
    /** Front-end analytics from the panel, its Composer and its answers, one `ChaiEvent` each. */
    onEvent?: (event: ChaiEvent) => void;
  }

  let {
    title,
    description,
    logo,
    side = "right",
    mode = "push",
    contained = false,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    launcher = true,
    promptTips = [],
    promptTipsLabel = "Getting started",
    pageContext = false,
    pageContextLabel = "This page",
    placeholder,
    answers = "simple",
    footer,
    voiceInput,
    textEngine,
    textModel,
    onEvent,
  }: SidePanelProps = $props();

  let turnCounter = 0;
  // svelte-ignore state_referenced_locally
  let openState = $state(defaultOpen);
  const isOpen = $derived(openProp ?? openState);
  let value = $state("");
  let turns = $state.raw<SidePanelThreadTurn[]>([]);
  // Page context is on per question: the person can take the chip off to ask something else.
  let pageOn = $state(true);
  let votes = $state.raw<Record<string, ResultCardVote>>({});
  const composer = useComposer(() => ({ textEngine, textModel }));
  let body = $state<HTMLElement>();
  const headingId = $props.id();

  const usePage = $derived(Boolean(pageContext) && pageOn);
  const live = $derived(composer.run?.results ?? []);
  const busy = $derived(live.some((r) => r.status === "queued" || r.status === "running"));
  const shown = $derived(turns.map((t, i) => (i === turns.length - 1 && composer.run ? { ...t, results: live } : t)));
  const conversation = $derived(turns.length > 0);

  // Follow the newest answer as it streams in, and once more when it ends
  // and its actions appear below it.
  $effect(() => {
    void [turns.length, sidePanelAnswerText(live[0]), live[0]?.status];
    tick().then(() => {
      if (body) body.scrollTop = body.scrollHeight;
    });
  });

  function reset() {
    composer.cancel();
    turns = [];
    votes = {};
    value = "";
    pageOn = true;
  }

  function setOpen(next: boolean) {
    onEvent?.(next ? sidePanelEvents.opened() : sidePanelEvents.closed(turns.length));
    if (!next) reset();
    if (openProp === undefined) openState = next;
    onOpenChange?.(next);
  }

  function newChat() {
    onEvent?.(sidePanelEvents.newChat(turns.length));
    reset();
  }

  function readPage(): PageContext {
    return typeof pageContext === "function" ? pageContext() : readPageContext();
  }

  /** Asks `prompt` after the `earlier` turns, with the page when `withPage`. */
  function send(prompt: string, withPage: boolean, earlier: SidePanelThreadTurn[], payload?: ComposerSubmitPayload) {
    const full = buildSidePanelPrompt({ prompt, page: withPage ? readPage() : null, history: sidePanelHistory(earlier) });
    turns = [...earlier, { id: `turn-${++turnCounter}`, prompt, withPage, results: [] }];
    composer.submit(payload ? { ...payload, value: full } : sidePanelTextPayload(full));
  }

  function ask(prompt: string, payload?: ComposerSubmitPayload) {
    const text = prompt.trim();
    if (!text || busy) return;
    value = "";
    send(text, usePage, shown, payload);
  }

  function useTip(tip: string, index: number) {
    onEvent?.(sidePanelEvents.tipUsed(index));
    ask(tip);
  }

  // Only the newest answer can be retried: it's the one the store holds.
  function retry(turn: SidePanelThreadTurn) {
    send(turn.prompt, turn.withPage, shown.slice(0, -1));
  }

  function vote(turnId: string, v: "like" | "dislike") {
    votes = { ...votes, [turnId]: votes[turnId] === v ? null : v };
  }

  function simpleAction(turn: SidePanelThreadTurn, action: "like" | "dislike" | "retry" | "copy") {
    onEvent?.(resultCardEvents.action(action));
    if (action === "like" || action === "dislike") vote(turn.id, action);
    else if (action === "retry") retry(turn);
  }

  // ResultCard reports its own action events.
  function cardAction(turn: SidePanelThreadTurn, newest: boolean, action: string) {
    if (action === "like" || action === "dislike") vote(turn.id, action);
    else if (action === "retry" && newest) retry(turn);
  }

  function setPage(on: boolean) {
    onEvent?.(sidePanelEvents.pageContextToggled(on));
    pageOn = on;
  }
</script>

{#snippet pageIcon()}<Icon icon={PageIcon} />{/snippet}

{#snippet mark()}
  {#if logo}{@render logo()}{:else}<Icon icon={SparkleIcon} />{/if}
{/snippet}

{#snippet composerBar(menuPlacement: "above" | "below")}
  <Composer
    {value}
    onChange={(v) => (value = v)}
    placeholder={placeholder ?? (usePage ? SIDE_PANEL_PAGE_PLACEHOLDER : SIDE_PANEL_PLACEHOLDER)}
    models={[]}
    onSubmit={(p) => ask(p.value, p)}
    submitting={busy}
    onAbort={composer.cancel}
    {voiceInput}
    {menuPlacement}
    {onEvent}
    contextChips={usePage ? [{ id: "page", label: pageContextLabel, icon: pageIcon, onRemove: () => setPage(false) }] : []}
    extraMenuItems={pageContext && !pageOn
      ? [{ id: "page", label: `Use ${pageContextLabel.toLowerCase()}`, icon: pageIcon, onSelect: () => setPage(true) }]
      : []}
  />
{/snippet}

{#if !isOpen}
  {#if launcher}
    <button
      type="button"
      class={["chai-side-panel__launcher", `chai-side-panel__launcher--${side}`, { "chai-side-panel__launcher--contained": contained }]}
      aria-label={`Open ${title}`}
      title={`Open ${title}`}
      onclick={() => setOpen(true)}
    >
      {@render mark()}
    </button>
  {/if}
{:else}
  <aside
    class={["chai-side-panel", `chai-side-panel--${side}`, `chai-side-panel--${mode}`, { "chai-side-panel--contained": contained }]}
    aria-labelledby={headingId}
    data-chai-page-context="skip"
  >
    <div class={["chai-side-panel__head", { "chai-side-panel__head--divided": conversation }]}>
      {#if conversation}
        <div class="chai-side-panel__title">
          <span class="chai-side-panel__logo">{@render mark()}</span>
          <h2 id={headingId} class="chai-side-panel__title-text">{title}</h2>
        </div>
      {/if}
      <div class="chai-side-panel__actions">
        {#if conversation}
          <button type="button" class="chai-side-panel__icon-btn" aria-label="New chat" title="New chat" onclick={newChat}>
            <Icon icon={NewChatIcon} />
          </button>
        {/if}
        <button type="button" class="chai-side-panel__icon-btn" aria-label="Close" title="Close" onclick={() => setOpen(false)}>
          <Icon icon={CloseSymbolIcon} />
        </button>
      </div>
    </div>

    <div bind:this={body} class="chai-side-panel__body">
      {#if conversation}
        <div class="chai-side-panel__thread">
          {#each shown as turn, i (turn.id)}
            <div class="chai-side-panel__turn">
              {#if turn.withPage}
                <span class="chai-side-panel__sent-with"><Icon icon={PageIcon} />With {pageContextLabel.toLowerCase()}</span>
              {/if}
              <p class="chai-side-panel__prompt">{turn.prompt}</p>
              {#if answers === "card"}
                {#if turn.results[0]}
                  <ResultCard
                    results={turn.results}
                    prompt={turn.prompt}
                    getVote={() => votes[turn.id] ?? null}
                    onAction={(action) => cardAction(turn, i === shown.length - 1, action)}
                    {onEvent}
                  />
                {/if}
              {:else}
                <SimpleAnswer
                  result={turn.results[0]}
                  vote={votes[turn.id] ?? null}
                  canRetry={i === shown.length - 1}
                  onAction={(action) => simpleAction(turn, action)}
                />
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="chai-side-panel__empty">
          <div class="chai-side-panel__hello">
            <span class="chai-side-panel__logo chai-side-panel__logo--large">{@render mark()}</span>
            <h2 id={headingId} class="chai-side-panel__heading">{title}</h2>
            {#if description}<p class="chai-side-panel__description">{description}</p>{/if}
          </div>
          {@render composerBar("below")}
          {#if promptTips.length > 0}
            <div class="chai-side-panel__tips" role="group" aria-label={promptTipsLabel}>
              <span class="chai-side-panel__tips-label">{promptTipsLabel}</span>
              {#each promptTips as tip, index (tip)}
                <button type="button" class="chai-side-panel__tip" onclick={() => useTip(tip, index)}>{tip}</button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if conversation || footer}
      <div class="chai-side-panel__dock">
        {#if conversation}{@render composerBar("above")}{/if}
        {#if footer}
          <p class="chai-side-panel__footer">{#if typeof footer === "string"}{footer}{:else}{@render footer()}{/if}</p>
        {/if}
      </div>
    {/if}
  </aside>
{/if}
