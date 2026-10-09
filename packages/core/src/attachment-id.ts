/** A unique id for an attachment. Internal: not exported from the package. */
export function attachmentId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
