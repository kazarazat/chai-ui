<script lang="ts">
  /**
   * An agent's reply with an interactive element in it: a call-to-action
   * button, approve or decline, a form, single or multiple choice, choice
   * cards, or a media request. It locks once answered and keeps a short
   * label of what the person did ("You clicked Cancel"). Same markup and
   * classes as the React component.
   */
  import { onMount } from "svelte";
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
  import Icon from "./Icon.svelte";
  import SearchMenu from "./primitives/SearchMenu.svelte";
  import { CheckIcon, CloseSymbolIcon, MixedMediaIcon } from "./icons.js";

  let {
    text,
    element,
    answer,
    onAnswer,
    onEvent,
  }: {
    /** The agent's words above the element. */
    text?: string;
    /** What to draw: an action, a form, a choice or a media request. */
    element: InteractiveElement;
    /** The answer, once there is one: pass a saved answer to show it locked after a reload. */
    answer?: InteractiveAnswer | null;
    /** Called once, when the person answers. Send it on to your agent. */
    onAnswer?: (answer: InteractiveAnswer) => void;
    /** Analytics: the element shown, and answered (kinds and counts only). */
    onEvent?: (event: ChaiEvent) => void;
  } = $props();

  const id = $props.id();
  let own = $state<InteractiveAnswer | null>(null);
  const locked = $derived(answer ?? own);

  onMount(() => {
    // Shown once, when it first appears unanswered (not when a saved thread reloads).
    if (!locked) onEvent?.(interactiveResponseEvents.shown(element));
  });

  function submit(next: InteractiveAnswer) {
    if (locked) return;
    own = next;
    onEvent?.(interactiveResponseEvents.answered(element, next));
    onAnswer?.(next);
  }

  // Action
  const decision = $derived(locked?.type === "action" ? locked.decision : null);

  // Form
  let values = $state<Record<string, string>>({});
  const shownValues = $derived(locked?.type === "form" ? locked.values : values);
  const formReady = $derived(element.type === "form" && interactiveFormReady(element, values));
  function sendForm(e: SubmitEvent) {
    e.preventDefault();
    if (formReady) submit({ type: "form", values: { ...values } });
  }

  // Choice
  let selected = $state<string[]>([]);
  let other = $state("");
  const shownSelected = $derived(locked?.type === "choice" ? locked.selected : selected);
  const shownOther = $derived(locked?.type === "choice" ? (locked.other ?? "") : other);
  const choiceReady = $derived(interactiveChoiceReady(selected, other));
  const listOptions = $derived(
    element.type === "choice"
      ? [
          ...element.options,
          ...(element.allowOther ? [{ id: INTERACTIVE_OTHER_ID, label: interactiveOtherLabel(element), description: undefined }] : []),
        ]
      : []
  );
  function pick(optionId: string) {
    if (locked || element.type !== "choice") return;
    selected = nextInteractiveSelection(element, selected, optionId);
  }
  function sendChoice() {
    if (!choiceReady) return;
    const next: InteractiveAnswer = { type: "choice", selected: [...selected] };
    if (selected.includes(INTERACTIVE_OTHER_ID)) next.other = other.trim();
    submit(next);
  }

  // Media
  let fileInput = $state<HTMLInputElement>();
  let files = $state<File[]>([]);
  let dragging = $state(false);
  const shownFiles = $derived(locked?.type === "media" ? locked.files.map((f) => f.name) : files.map((f) => f.name));
  function addFiles(list: FileList | null | undefined) {
    if (!list || element.type !== "media") return;
    files = acceptInteractiveFiles(element, [...files, ...Array.from(list)]);
  }
</script>

<div class={["chai-interactive", { "chai-interactive--locked": locked }]}>
  {#if text}<div class="chai-interactive__text">{text}</div>{/if}
  <div class="chai-interactive__body">
    {#if element.type === "action"}
      <div class="chai-interactive__actions">
        {#if element.confirm}
          <button
            type="button"
            class={["chai-btn chai-btn--outlined", { "chai-interactive__picked": decision === "declined" }]}
            disabled={Boolean(locked)}
            onclick={() => submit({ type: "action", decision: "declined" })}
          >
            {interactiveDeclineLabel(element)}
          </button>
        {/if}
        <button
          type="button"
          class={["chai-btn chai-interactive__primary", { "chai-interactive__picked": decision === "accepted" }]}
          disabled={Boolean(locked)}
          onclick={() => submit({ type: "action", decision: "accepted" })}
        >
          {element.label}
        </button>
      </div>
    {:else if element.type === "form"}
      <form class="chai-interactive__form" onsubmit={sendForm}>
        {#each element.fields as field (field.id)}
          <div class="chai-interactive__field">
            <label for={`${id}-${field.id}`} class="chai-interactive__label">
              {field.label}{#if field.required}<span aria-hidden="true"> *</span>{/if}
            </label>
            {#if field.kind === "textarea"}
              <textarea
                id={`${id}-${field.id}`}
                class="chai-interactive__input"
                rows="3"
                value={shownValues[field.id] ?? ""}
                required={field.required}
                disabled={Boolean(locked)}
                placeholder={locked ? undefined : field.placeholder}
                oninput={(e) => (values = { ...values, [field.id]: e.currentTarget.value })}
              ></textarea>
            {:else if field.kind === "select"}
              <!-- The same dropdown as the Composer's and Media analyzer's menus. -->
              <div class={["chai-interactive__select", { "chai-interactive__select--empty": !shownValues[field.id] }]}>
                <SearchMenu
                  triggerId={`${id}-${field.id}`}
                  options={(field.options ?? []).map((o) => ({ id: o, label: o }))}
                  value={shownValues[field.id] ?? null}
                  triggerLabel={shownValues[field.id] || (locked ? "" : field.placeholder || "Choose")}
                  menuLabel={field.label}
                  searchable={false}
                  disabled={Boolean(locked)}
                  onSelect={(o) => (values = { ...values, [field.id]: o.id })}
                />
              </div>
            {:else}
              <input
                id={`${id}-${field.id}`}
                class="chai-interactive__input"
                type={field.kind ?? "text"}
                value={shownValues[field.id] ?? ""}
                required={field.required}
                disabled={Boolean(locked)}
                placeholder={locked ? undefined : field.placeholder}
                oninput={(e) => (values = { ...values, [field.id]: e.currentTarget.value })}
              />
            {/if}
          </div>
        {/each}
        {#if !locked}
          <div class="chai-interactive__actions">
            <button type="submit" class="chai-btn chai-interactive__primary" disabled={!formReady}>
              {interactiveSubmitLabel(element)}
            </button>
          </div>
        {/if}
      </form>
    {:else if element.type === "choice"}
      <div class="chai-interactive__choice">
        {#if element.display === "cards"}
          <div class="chai-interactive__cards" role="group">
            {#each element.options as o (o.id)}
              <button
                type="button"
                class={["chai-interactive__card", { "chai-interactive__card--selected": shownSelected.includes(o.id) }]}
                aria-pressed={shownSelected.includes(o.id)}
                disabled={Boolean(locked)}
                onclick={() => pick(o.id)}
              >
                {#if o.image}<img src={o.image} alt="" class="chai-interactive__card-image" />{/if}
                <span class="chai-interactive__card-label">{o.label}</span>
                {#if o.description}<span class="chai-interactive__description">{o.description}</span>{/if}
                {#if shownSelected.includes(o.id)}
                  <span class="chai-interactive__card-check" aria-hidden="true"><Icon icon={CheckIcon} /></span>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <div class="chai-interactive__options" role={element.multiple ? "group" : "radiogroup"}>
            {#each listOptions as o (o.id)}
              <label class="chai-interactive__option">
                <!-- Locked without `disabled`: browsers gray out a disabled input, the chosen one included. -->
                <input
                  type={element.multiple ? "checkbox" : "radio"}
                  name={id}
                  checked={shownSelected.includes(o.id)}
                  aria-disabled={locked ? true : undefined}
                  tabindex={locked ? -1 : undefined}
                  onchange={() => pick(o.id)}
                />
                <span class="chai-interactive__option-text">
                  <span>{o.label}</span>
                  {#if o.description}<span class="chai-interactive__description">{o.description}</span>{/if}
                </span>
              </label>
            {/each}
            {#if element.allowOther && shownSelected.includes(INTERACTIVE_OTHER_ID)}
              <input
                class="chai-interactive__input chai-interactive__other"
                aria-label={interactiveOtherLabel(element)}
                placeholder="Type your answer"
                value={shownOther}
                disabled={Boolean(locked)}
                oninput={(e) => (other = e.currentTarget.value)}
                onkeydown={(e) => e.key === "Enter" && sendChoice()}
              />
            {/if}
          </div>
        {/if}
        {#if !locked}
          <div class="chai-interactive__actions">
            <button type="button" class="chai-btn chai-interactive__primary" disabled={!choiceReady} onclick={sendChoice}>
              {interactiveSubmitLabel(element)}
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="chai-interactive__media">
        {#if !locked}
          <div
            class={["chai-interactive__dropzone", { "chai-interactive__dropzone--drag-active": dragging }]}
            role="button"
            tabindex="0"
            onclick={() => fileInput?.click()}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInput?.click();
              }
            }}
            ondragover={(e) => {
              e.preventDefault();
              dragging = true;
            }}
            ondragleave={() => (dragging = false)}
            ondrop={(e) => {
              e.preventDefault();
              dragging = false;
              addFiles(e.dataTransfer?.files);
            }}
          >
            <span class="chai-interactive__dropzone-icon" aria-hidden="true"><Icon icon={MixedMediaIcon} /></span>
            <span class="chai-interactive__dropzone-hint">{interactiveMediaHint(element)}</span>
            <input
              bind:this={fileInput}
              type="file"
              hidden
              accept={interactiveMediaAccept(element)}
              multiple={(element.max ?? 1) > 1}
              onchange={(e) => {
                addFiles(e.currentTarget.files);
                e.currentTarget.value = "";
              }}
            />
          </div>
        {/if}
        {#if shownFiles.length > 0}
          <ul class="chai-interactive__files">
            {#each shownFiles as fileName, i (`${fileName}-${i}`)}
              <li class="chai-interactive__file">
                <span>{fileName}</span>
                {#if !locked}
                  <button
                    type="button"
                    class="chai-interactive__file-remove"
                    aria-label={`Remove ${fileName}`}
                    onclick={() => (files = files.filter((_, j) => j !== i))}
                  >
                    <Icon icon={CloseSymbolIcon} />
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if !locked}
          <div class="chai-interactive__actions">
            {#if element.skipLabel}
              <button type="button" class="chai-btn chai-btn--outlined" onclick={() => submit({ type: "media", files: [] })}>
                {element.skipLabel}
              </button>
            {/if}
            <button
              type="button"
              class="chai-btn chai-interactive__primary"
              disabled={files.length === 0}
              onclick={() => submit({ type: "media", files: files.map((file) => ({ name: file.name, file })) })}
            >
              {interactiveSubmitLabel(element)}
            </button>
          </div>
        {/if}
      </div>
    {/if}

    {#if locked}
      <p class="chai-interactive__answered" role="status">
        <Icon icon={CheckIcon} />
        {interactiveAnswerLabel(element, locked)}
      </p>
    {/if}
  </div>
</div>
