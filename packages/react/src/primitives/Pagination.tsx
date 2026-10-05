import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

interface PaginationProps {
  count: number;
  index: number;
  onChange: (index: number) => void;
  /** Accessible name for the pager, e.g. "Results". */
  label: string;
  /** What one page is, for the current position ("Result 2 of 3"). Defaults to "Result". */
  itemLabel?: string;
  disabled?: boolean;
}

/**
 * Progress-style pager (reference: the Figma "Pagination" asset, e.g. the
 * Result Card mock) — a pill that fills from page 1 up to
 * the current page under a row of plain dots, not independent per-page
 * dots with a stretched active one. A standalone primitive, not part of
 * any one component, so every paginated surface renders the same pager
 * rather than each growing its own.
 *
 * One control, not a button per dot: the dots sit closer than WCAG 2.2's
 * 24px target spacing (2.5.8) allows for separate targets, so the whole row
 * is a single slider. A click picks the nearest dot; arrow keys, Home and
 * End move between pages.
 */
export function Pagination({ count, index, onChange, label, itemLabel = "Result", disabled }: PaginationProps) {
  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(count - 1, next));
    if (clamped !== index) onChange(clamped);
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    go(Math.floor(((e.clientX - rect.left) / rect.width) * count));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target =
      e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageDown"
        ? index + 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageUp"
          ? index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? count - 1
              : null;
    if (target == null) return;
    e.preventDefault();
    go(target);
  };

  return (
    <div
      className={`chai-pagination${disabled ? " chai-pagination--disabled" : ""}`}
      role="slider"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
      aria-valuetext={`${itemLabel} ${index + 1} of ${count}`}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ "--chai-pagination-fill": `${((index + 1) / count) * 100}%` } as CSSProperties}
    >
      <span className="chai-pagination__track" aria-hidden="true" />
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`chai-pagination__dot${i <= index ? " chai-pagination__dot--filled" : ""}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
