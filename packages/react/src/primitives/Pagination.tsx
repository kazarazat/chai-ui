import type { CSSProperties } from "react";

interface PaginationProps {
  count: number;
  index: number;
  onChange: (index: number) => void;
  /** Accessible name for the nav landmark, e.g. "Results". */
  label: string;
  /** What one page is, for each dot's name ("Result 2 of 3"). Defaults to "Result". */
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
 */
export function Pagination({ count, index, onChange, label, itemLabel = "Result", disabled }: PaginationProps) {
  return (
    <nav
      className="chai-pagination"
      aria-label={label}
      style={{ "--chai-pagination-fill": `${((index + 1) / count) * 100}%` } as CSSProperties}
    >
      <span className="chai-pagination__track" aria-hidden="true" />
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          className={`chai-pagination__dot${i <= index ? " chai-pagination__dot--filled" : ""}`}
          aria-current={i === index}
          aria-label={`${itemLabel} ${i + 1} of ${count}`}
          disabled={disabled}
          onClick={() => onChange(i)}
        />
      ))}
    </nav>
  );
}
