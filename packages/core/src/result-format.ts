/** How `ResultCard` shows a result's details, the same in every framework binding. */
import { ROUTING_MODEL_ID, type Result } from "./run.js";
import type { ModelOption } from "./types.js";

export function formatDuration(ms: number | undefined): string | undefined {
  return ms == null ? undefined : `${(ms / 1000).toFixed(2)}s`;
}

export function formatCost(usd: number | undefined): string | undefined {
  return usd == null ? undefined : `$${usd.toFixed(2)}`;
}

export function formatTokens(total: number | undefined): string | undefined {
  return total == null ? undefined : `${total.toLocaleString()} tokens`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** A real, exactly-reduced ratio (e.g. 1024×768 → "4:3", 1920×1080 → "16:9") from the media's own measured dimensions — not a guess at the nearest "named" ratio, so an unusual crop just shows its own honest (if less familiar) reduced fraction instead of a misleading rounded one. */
export function formatAspectRatio(width: number, height: number): string | undefined {
  if (!width || !height) return undefined;
  const w = Math.round(width);
  const h = Math.round(height);
  const divisor = gcd(w, h);
  return `${w / divisor}:${h / divisor}`;
}

/** The model's label from `models`, falling back to its raw id; "Choosing model…" while auto-select is still picking. */
export function resultModelLabel(result: Result, models?: ModelOption[]): string {
  if (result.modelId === ROUTING_MODEL_ID) return "Choosing model…";
  return models?.find((m) => m.id === result.modelId)?.label ?? result.modelId;
}
