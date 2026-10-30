import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  type PageContext,
  type Result,
  type SidePanelThreadTurn,
  type VoiceInputConfig,
} from "@chai-ui/core";
import { Composer } from "./Composer.js";
import { ResultCard, type ResultCardVote } from "./ResultCard.js";
import { useComposer, type UseComposerOptions } from "./useComposer.js";
import {
  CloseSymbolIcon,
  CopyIcon,
  NewChatIcon,
  PageIcon,
  RefreshIcon,
  SparkleIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "./icons.js";

export interface SidePanelProps extends Pick<UseComposerOptions, "textEngine" | "textModel"> {
  /** The assistant's name: the greeting's heading, then the header once a conversation starts. */
  title: string;
  /** One line under the greeting. */
  description?: string;
  /** Your mark, about 44px in the greeting and 28px in the header. Defaults to a sparkle. */
  logo?: ReactNode;
  /** Which edge of the page the panel sits on. */
  side?: "right" | "left";
  /**
   * `"push"` (default): the panel takes its own width beside your content,
   * so place it as a flex sibling of your page. `"overlay"`: it floats over
   * the page. Below 600px wide, both open as a full-screen sheet.
   */
  mode?: "push" | "overlay";
  /**
   * The overlay and launcher position inside the nearest positioned parent
   * instead of the browser window, for a panel that belongs to one part of
   * your page.
   */
  contained?: boolean;
  /** Controlled open state. Leave it out and the panel keeps its own, starting from `defaultOpen`. */
  open?: boolean;
  defaultOpen?: boolean;
  /** Fires on the launcher and on Close. Closing clears the conversation. */
  onOpenChange?: (open: boolean) => void;
  /** The floating button that opens the panel. Turn it off to open the panel from your own button with `open`. */
  launcher?: boolean;
  /**
   * Short example prompts in the empty state. A tap sends one. Include at
   * least one that isn't about the page: the panel is for any quick question.
   */
  promptTips?: string[];
  promptTipsLabel?: string;
  /**
   * Off by default. `true` reads the page (title, URL, selected text and
   * main text, see `readPageContext`) and sends it with each question,
   * shown as a removable chip; pass a function to read it your own way.
   * Sending a page's text to a model is your decision to make on purpose.
   */
  pageContext?: boolean | (() => PageContext);
  /** The page chip's label. */
  pageContextLabel?: string;
  /** Defaults to "Ask about this page, or ask something else" with the page chip on, else "Ask anything". */
  placeholder?: string;
  /** `"simple"` (default): answers as text on the panel. `"card"`: each answer in a full ResultCard. */
  answers?: "simple" | "card";
  /** A short note under the Composer, e.g. a disclaimer. */
  footer?: ReactNode;
  /** Dictation, as on the Composer. Off by default. */
  voiceInput?: VoiceInputConfig;
  /** Front-end analytics from the panel, its Composer and its answers, one `ChaiEvent` each. */
  onEvent?: (event: ChaiEvent) => void;
  className?: string;
  style?: CSSProperties;
}

let turnCounter = 0;

/**
 * A panel on one side of the page with the Composer and answers, for quick
 * model use without leaving the page. Questions can be about the page
 * (with `pageContext`) or about anything else.
 */
export function SidePanel({
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
  className,
  style,
}: SidePanelProps) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const [value, setValue] = useState("");
  const [turns, setTurns] = useState<SidePanelThreadTurn[]>([]);
  // Page context is on per question: the person can take the chip off to ask something else.
  const [pageOn, setPageOn] = useState(true);
  const [votes, setVotes] = useState<Record<string, ResultCardVote>>({});
  const composer = useComposer({ textEngine, textModel });
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  // Focus follows the panel: into the prompt when it opens, back to the
  // launcher when it closes. Not on first render, so a panel that starts
  // open doesn't take focus from the page.
  const wasOpen = useRef(open);
  const headingId = useId();

  const usePage = Boolean(pageContext) && pageOn;
  const live = composer.run?.results ?? [];
  const busy = live.some((r) => r.status === "queued" || r.status === "running");
  const shown = turns.map((t, i) => (i === turns.length - 1 && composer.run ? { ...t, results: live } : t));

  // Follow the newest answer as it streams in, and once more when it ends
  // and its actions appear below it.
  const lastText = sidePanelAnswerText(live[0]);
  const lastStatus = live[0]?.status;
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, lastText, lastStatus]);

  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    if (open) panelRef.current?.querySelector("textarea")?.focus();
    else launcherRef.current?.focus();
  }, [open]);

  function reset() {
    composer.cancel();
    setTurns([]);
    setVotes({});
    setValue("");
    setPageOn(true);
  }

  function setOpen(next: boolean) {
    onEvent?.(next ? sidePanelEvents.opened() : sidePanelEvents.closed(turns.length));
    if (!next) reset();
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  }

  function readPage(): PageContext {
    return typeof pageContext === "function" ? pageContext() : readPageContext();
  }

  /** Asks `prompt` after the `earlier` turns, with the page when `withPage`. */
  function send(prompt: string, withPage: boolean, earlier: SidePanelThreadTurn[], payload?: ComposerSubmitPayload) {
    const full = buildSidePanelPrompt({ prompt, page: withPage ? readPage() : null, history: sidePanelHistory(earlier) });
    setTurns([...earlier, { id: `turn-${++turnCounter}`, prompt, withPage, results: [] }]);
    composer.submit(payload ? { ...payload, value: full } : sidePanelTextPayload(full));
  }

  function ask(prompt: string, payload?: ComposerSubmitPayload) {
    const text = prompt.trim();
    if (!text || busy) return;
    setValue("");
    send(text, usePage, shown, payload);
  }

  // Only the newest answer can be retried: it's the one the store holds.
  function retry(turn: SidePanelThreadTurn) {
    send(turn.prompt, turn.withPage, shown.slice(0, -1));
  }

  function vote(turnId: string, v: "like" | "dislike") {
    setVotes((all) => ({ ...all, [turnId]: all[turnId] === v ? null : v }));
  }

  function setPage(on: boolean) {
    onEvent?.(sidePanelEvents.pageContextToggled(on));
    setPageOn(on);
  }

  const rootClass = [
    "chai-side-panel",
    `chai-side-panel--${side}`,
    `chai-side-panel--${mode}`,
    contained && "chai-side-panel--contained",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!open) {
    return launcher ? (
      <button
        ref={launcherRef}
        type="button"
        className={`chai-side-panel__launcher chai-side-panel__launcher--${side}${contained ? " chai-side-panel__launcher--contained" : ""}`}
        aria-label={`Open ${title}`}
        title={`Open ${title}`}
        onClick={() => setOpen(true)}
      >
        {logo ?? <SparkleIcon />}
      </button>
    ) : null;
  }

  const conversation = turns.length > 0;

  return (
    <aside
      ref={panelRef}
      className={rootClass}
      style={style}
      aria-labelledby={headingId}
      data-chai-page-context="skip"
      // Esc closes the panel, unless a menu inside it is open: Esc closes that first.
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.currentTarget.querySelector('[aria-expanded="true"]')) setOpen(false);
      }}
    >
      <div className={`chai-side-panel__head${conversation ? " chai-side-panel__head--divided" : ""}`}>
        {conversation && (
          <div className="chai-side-panel__title">
            <span className="chai-side-panel__logo">{logo ?? <SparkleIcon />}</span>
            <h2 id={headingId} className="chai-side-panel__title-text">
              {title}
            </h2>
          </div>
        )}
        <div className="chai-side-panel__actions">
          {conversation && (
            <button
              type="button"
              className="chai-side-panel__icon-btn"
              aria-label="New chat"
              title="New chat"
              onClick={() => {
                onEvent?.(sidePanelEvents.newChat(turns.length));
                reset();
              }}
            >
              <NewChatIcon />
            </button>
          )}
          <button type="button" className="chai-side-panel__icon-btn" aria-label="Close" title="Close" onClick={() => setOpen(false)}>
            <CloseSymbolIcon />
          </button>
        </div>
      </div>

      <div className="chai-side-panel__body" ref={bodyRef}>
        {conversation ? (
          <div className="chai-side-panel__thread">
            {shown.map((turn, i) => {
              const result = turn.results[0];
              const newest = i === shown.length - 1;
              return (
                <div key={turn.id} className="chai-side-panel__turn">
                  {turn.withPage && (
                    <span className="chai-side-panel__sent-with">
                      <PageIcon />
                      With {pageContextLabel.toLowerCase()}
                    </span>
                  )}
                  <p className="chai-side-panel__prompt">{turn.prompt}</p>
                  {answers === "card" ? (
                    result && (
                      <ResultCard
                        results={turn.results}
                        prompt={turn.prompt}
                        getVote={() => votes[turn.id] ?? null}
                        onAction={(action) => {
                          // ResultCard reports its own action events.
                          if (action === "like" || action === "dislike") vote(turn.id, action);
                          else if (action === "retry" && newest) retry(turn);
                        }}
                        onEvent={onEvent}
                      />
                    )
                  ) : (
                    <SimpleAnswer
                      result={result}
                      vote={votes[turn.id] ?? null}
                      onAction={(action) => {
                        onEvent?.(resultCardEvents.action(action));
                        if (action === "like" || action === "dislike") vote(turn.id, action);
                        else if (action === "retry") retry(turn);
                      }}
                      canRetry={newest}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="chai-side-panel__empty">
            <div className="chai-side-panel__hello">
              <span className="chai-side-panel__logo chai-side-panel__logo--large">{logo ?? <SparkleIcon />}</span>
              <h2 id={headingId} className="chai-side-panel__heading">
                {title}
              </h2>
              {description && <p className="chai-side-panel__description">{description}</p>}
            </div>
            {renderComposer("below")}
            {promptTips.length > 0 && (
              <div className="chai-side-panel__tips" role="group" aria-label={promptTipsLabel}>
                <span className="chai-side-panel__tips-label">{promptTipsLabel}</span>
                {promptTips.map((tip, index) => (
                  <button
                    key={tip}
                    type="button"
                    className="chai-side-panel__tip"
                    onClick={() => {
                      onEvent?.(sidePanelEvents.tipUsed(index));
                      ask(tip);
                    }}
                  >
                    {tip}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(conversation || footer) && (
        <div className="chai-side-panel__dock">
          {conversation && renderComposer("above")}
          {footer && <p className="chai-side-panel__footer">{footer}</p>}
        </div>
      )}
    </aside>
  );

  function renderComposer(menuPlacement: "above" | "below") {
    return (
      <Composer
        value={value}
        onChange={setValue}
        placeholder={placeholder ?? (usePage ? SIDE_PANEL_PAGE_PLACEHOLDER : SIDE_PANEL_PLACEHOLDER)}
        models={[]}
        onSubmit={(payload) => ask(payload.value, payload)}
        submitting={busy}
        onAbort={composer.cancel}
        voiceInput={voiceInput}
        menuPlacement={menuPlacement}
        onEvent={onEvent}
        contextChips={
          usePage ? [{ id: "page", label: pageContextLabel, icon: <PageIcon />, onRemove: () => setPage(false) }] : []
        }
        extraMenuItems={
          pageContext && !pageOn
            ? [{ id: "page", label: `Use ${pageContextLabel.toLowerCase()}`, icon: <PageIcon />, onSelect: () => setPage(true) }]
            : []
        }
      />
    );
  }
}

/** An answer as plain text on the panel, with like, dislike, retry and copy below it. */
function SimpleAnswer({
  result,
  vote,
  onAction,
  canRetry,
}: {
  result: Result | undefined;
  vote: ResultCardVote;
  onAction: (action: "like" | "dislike" | "retry" | "copy") => void;
  canRetry: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  const text = sidePanelAnswerText(result);
  const streaming = result.status === "queued" || result.status === "running";

  if (result.status === "error") {
    return (
      <div className="chai-side-panel__answer-wrap">
        <p className="chai-side-panel__answer chai-side-panel__answer--error" role="alert">
          {result.error?.message ?? "Something went wrong."}
        </p>
        {canRetry && (
          <div className="chai-side-panel__answer-actions">
            <AnswerButton label="Retry" onClick={() => onAction("retry")}>
              <RefreshIcon />
            </AnswerButton>
          </div>
        )}
      </div>
    );
  }
  if (result.status === "cancelled") {
    return <p className="chai-side-panel__answer chai-side-panel__answer--muted">Stopped</p>;
  }

  return (
    <div className="chai-side-panel__answer-wrap">
      <p
        className={`chai-side-panel__answer${streaming ? " chai-side-panel__answer--streaming" : ""}`}
        // Screen readers wait for the finished text instead of announcing every chunk.
        aria-busy={streaming}
      >
        {text}
      </p>
      {!streaming && (
        <div className="chai-side-panel__answer-actions">
          <AnswerButton label="Like" pressed={vote === "like"} onClick={() => onAction("like")}>
            <ThumbUpIcon />
          </AnswerButton>
          <AnswerButton label="Dislike" pressed={vote === "dislike"} onClick={() => onAction("dislike")}>
            <ThumbDownIcon />
          </AnswerButton>
          {canRetry && (
            <AnswerButton label="Retry" onClick={() => onAction("retry")}>
              <RefreshIcon />
            </AnswerButton>
          )}
          <AnswerButton
            label={copied ? "Copied" : "Copy"}
            onClick={() => {
              onAction("copy");
              navigator.clipboard?.writeText(text).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                },
                () => undefined
              );
            }}
          >
            <CopyIcon />
          </AnswerButton>
        </div>
      )}
    </div>
  );
}

function AnswerButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`chai-side-panel__answer-btn${pressed ? " chai-side-panel__answer-btn--active" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
