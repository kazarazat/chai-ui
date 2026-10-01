import { createComponent } from "@lit/react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import { MdCheckbox } from "@material/web/checkbox/checkbox.js";
import { Toggle } from "./Toggle.js";

const MdOutlinedTextFieldElement = createComponent({
  react: React,
  tagName: "md-outlined-text-field",
  elementClass: MdOutlinedTextField,
  events: { onInput: "input" },
});

/**
 * MD3's `<md-checkbox>`, shown as a leading checkbox on each row in
 * multi-select mode — MD3's own pattern for picking several items from a
 * list. Display only: the row button stays the one interactive, selectable
 * element (a focusable checkbox inside a button would be two controls in
 * one place), so the checkbox is `aria-hidden`, out of the tab order and
 * ignores pointer events.
 */
const MdCheckboxElement = createComponent({
  react: React,
  tagName: "md-checkbox",
  elementClass: MdCheckbox,
});

/** MD3 "check" symbol (Figma) — marking the selected row in any option list below. */
function CheckIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M7.1625 13.5L2.8875 9.225L3.95625 8.15625L7.1625 11.3625L14.0438 4.48125L15.1125 5.55L7.1625 13.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export interface SearchMenuOption {
  id: string;
  /** Shown on the trigger once this option is selected, and used for search-filtering. Keep this the short/canonical name. */
  label: string;
  /**
   * Shown in the option row itself instead of `label`, if given — e.g. a
   * longer, clarifying variant ("Terse (short)") that would read as
   * cluttered on a closed trigger button but is genuinely useful while
   * still choosing (reference: Media Analyzer's "Prompt length" menu).
   * Falls back to `label` when omitted.
   */
  rowLabel?: string;
}

/** One labeled group of options, rendered under its own header with a divider before the next group (reference: Media Analyzer's "Select model" menu — Image/Video/Audio sections). */
export interface SearchMenuSection<T extends SearchMenuOption> {
  label: string;
  options: T[];
}

/**
 * A toggle pinned above every group, in its own bordered/tinted block with
 * a floating label — e.g. Media Analyzer's "Auto-select model" (reference:
 * the design mock). While `value` is true, every option row
 * below becomes non-interactive — grayed out, `disabled` for real — but
 * still shows its checkmark on whichever option is the menu's own `value`
 * (the last *manual* pick), so switching the toggle back off returns to
 * exactly that one instead of losing it.
 */
export interface SearchMenuToggleHeader {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

interface SearchMenuProps<T extends SearchMenuOption> {
  /** A flat option list. Ignored if `sections` is given. */
  options?: T[];
  /** Grouped options, each under its own header with a divider between groups — an alternative to `options` for a menu that needs section dividers by category. */
  sections?: SearchMenuSection<T>[];
  toggleHeader?: SearchMenuToggleHeader;
  /** The currently effective option's id, if any — checkmarked in the list. An array with `multiple`. */
  value: string | string[] | null;
  /** Several options can be checked at once: each row gets a leading checkbox (MD3's multi-select list pattern), a row click toggles it and the panel stays open. `onSelect` still fires with the clicked option; the caller owns adding or removing it. */
  multiple?: boolean;
  /** Text shown on the trigger button. */
  triggerLabel: string;
  /** Floating label on the search field and the panel's aria-label. */
  menuLabel: string;
  onSelect: (option: T) => void;
  disabled?: boolean;
  /** Show the search field in the panel. Default true. Set false for a short, fixed option list (reference: Composer's Model/Aspect ratio triggers) where searching adds nothing. */
  searchable?: boolean;
  /** "outlined" (default) matches `.chai-btn--outlined`; "text" drops the border entirely — chevron + label only (reference: Composer's Model/Aspect ratio triggers). */
  triggerVariant?: "outlined" | "text";
  /** Panel width in px (default 280) — widen for a menu whose option labels run long; anything still too long past that ellipsizes rather than wrapping or overflowing. */
  panelWidth?: number;
}

/**
 * The searchable menu-button pattern behind every Model/option menu
 * (reference: Media Analyze - Model Menu) — a trigger styled as MD3's outlined button, opening an anchored panel with
 * a search field (a real `<md-outlined-text-field>`, for its floating-label
 * + icon-slot behavior) over a plain option list. Hand-rolled rather than
 * `<md-menu>`: this needs to live inline as a simple absolutely-positioned
 * panel under the trigger, not `<md-menu>`'s own corner-anchored popover
 * positioning model — same reasoning SegmentedButton documents for why it
 * isn't a `@material/web` custom element either.
 */
export function SearchMenu<T extends SearchMenuOption>({
  options,
  sections,
  toggleHeader,
  value,
  multiple = false,
  triggerLabel,
  menuLabel,
  onSelect,
  disabled,
  searchable = true,
  triggerVariant = "outlined",
  panelWidth = 280,
}: SearchMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Closing also clears the search, so the menu reopens on the full list.
  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const raw = sections ?? [{ label: "", options: options ?? [] }];
    if (!q) return raw;
    return raw
      .map((g) => ({
        ...g,
        options: g.options.filter(
          (o) => o.label.toLowerCase().includes(q) || o.rowLabel?.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.options.length > 0);
  }, [options, sections, search]);
  const hasAnyOption = groups.some((g) => g.options.length > 0);
  const isSelected = (id: string) => (Array.isArray(value) ? value.includes(id) : id === value);

  return (
    <div className="chai-search-menu" ref={rootRef}>
      <button
        type="button"
        className={`${triggerVariant === "outlined" ? "chai-btn chai-btn--outlined" : "chai-search-menu__trigger--text"} chai-search-menu__trigger${
          open ? " chai-search-menu__trigger--open" : ""
        }`}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="chai-search-menu__trigger-label" title={triggerLabel}>
          {triggerLabel}
        </span>
        {/* Material Symbols "keyboard_arrow_down" (real path, from the
            @material-symbols/svg-400 package — not hand-traced), trailing
            per the mock's own reference code (`TrailingElement` wrapping
            the icon on both `Aspect_ratio_select` and `model_select`), not
            leading like `ModelMenu`'s older trigger. */}
        <svg
          className={`chai-search-menu__chevron${open ? " chai-search-menu__chevron--open" : ""}`}
          viewBox="0 -960 960 960"
          aria-hidden="true"
        >
          <path d="M480-344 240-584l43-43 197 197 197-197 43 43-240 240Z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          className="chai-search-menu__panel"
          role="group"
          aria-label={menuLabel}
          style={{ width: panelWidth }}
        >
          {toggleHeader && (
            <div className="chai-search-menu__toggle-header">
              <span className="chai-search-menu__toggle-header-label">{menuLabel}</span>
              <span className="chai-search-menu__toggle-header-row">
                <span className="chai-search-menu__toggle-header-text">{toggleHeader.label}</span>
                <Toggle value={toggleHeader.value} onChange={toggleHeader.onChange} ariaLabel={toggleHeader.label} />
              </span>
            </div>
          )}
          {searchable && (
            <MdOutlinedTextFieldElement
              className="chai-search-menu__search"
              label={menuLabel}
              placeholder="Input"
              value={search}
              onInput={(e) => setSearch((e.target as MdOutlinedTextField).value)}
            >
              <span slot="leading-icon" className="chai-search-menu__search-icon">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              {search && (
                <button
                  type="button"
                  slot="trailing-icon"
                  className="chai-search-menu__clear"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path d="m9 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </MdOutlinedTextFieldElement>
          )}

          <ul className="chai-search-menu__list">
            {groups.map((group, i) => (
              <li key={group.label || i}>
                {group.label && <p className="chai-search-menu__section-label">{group.label}</p>}
                <ul className="chai-search-menu__section-list" aria-label={group.label || undefined}>
                  {group.options.map((o) => (
                    <li key={o.id}>
                      {/* Plain buttons, reached with Tab: `aria-pressed` says which are picked. */}
                      <button
                        type="button"
                        aria-pressed={isSelected(o.id)}
                        disabled={toggleHeader?.value}
                        className={`chai-search-menu__option${
                          !multiple && isSelected(o.id) ? " chai-search-menu__option--selected" : ""
                        }`}
                        onClick={() => {
                          onSelect(o);
                          if (!multiple) close();
                        }}
                      >
                        {multiple && (
                          <MdCheckboxElement
                            className="chai-search-menu__checkbox"
                            checked={isSelected(o.id)}
                            disabled={toggleHeader?.value}
                            tabIndex={-1}
                            aria-hidden="true"
                          />
                        )}
                        <span className="chai-search-menu__option-label">{o.rowLabel ?? o.label}</span>
                        {!multiple && isSelected(o.id) && <CheckIcon />}
                      </button>
                    </li>
                  ))}
                </ul>
                {i < groups.length - 1 && <hr className="chai-search-menu__divider" role="separator" />}
              </li>
            ))}
            {!hasAnyOption && <li className="chai-search-menu__empty">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
