/**
 * Download and share for a piece of generated media, shared by the cards.
 *
 * A plain `<a download href={remoteUrl}>` only forces a download for a
 * same-origin or `blob:`/`data:` URL; for a cross-origin CDN URL (what a
 * generated result usually is) browsers ignore `download` and open it
 * instead. Fetching it into a blob first works wherever the source allows
 * cross-origin fetches. When it doesn't, opening the media is the fallback.
 */
export async function downloadMedia(src: string, filename: string): Promise<void> {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(src, "_blank", "noopener");
  }
}

/**
 * The native share sheet where there is one, otherwise the media's URL
 * copied to the clipboard. Says which, so the button can confirm a copy.
 */
export async function shareMedia(src: string): Promise<"shared" | "copied" | "none"> {
  if (navigator.share) {
    try {
      await navigator.share({ url: src });
      return "shared";
    } catch {
      // Dismissed, or not shareable: same as closing a native share sheet.
      return "none";
    }
  }
  try {
    await navigator.clipboard.writeText(src);
    return "copied";
  } catch {
    return "none";
  }
}

/** A file name for a download: the URL's own extension when it has one, otherwise a guess by kind. */
export function downloadFilename(id: string, kind: string, src: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/.exec(src);
  const ext = match?.[1] ?? (kind === "video" ? "mp4" : kind === "audio" ? "mp3" : kind === "text" ? "txt" : "png");
  return `${kind}-${id}.${ext}`;
}
