/** A style object from core (kebab-case keys, e.g. `regionBoxStyle`) as the string Svelte's `style` takes. */
export const styleString = (style: Record<string, string>) =>
  Object.entries(style)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
