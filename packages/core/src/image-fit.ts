/**
 * Fitting a video's start image to the picked aspect ratio, so the ratio
 * wins even on image-to-video models that take the image's own shape.
 */
import type { DroppedMedia } from "./types.js";

/** How a start image meets the picked ratio: cropped around its center, or padded with black bars. */
export type StartImageFit = "crop" | "pad";

/**
 * The image redrawn at `ratio` (e.g. "16:9"), as a JPEG data URL. Returns
 * `src` unchanged when it already has that shape, the ratio isn't "w:h",
 * or there's no canvas to draw on (a server, or a test DOM).
 */
export async function fitImageToRatio(src: string, ratio: string, fit: StartImageFit): Promise<string> {
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h || typeof document === "undefined") return src;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  const img = await loadImage(src).catch(() => null);
  if (!img) return src;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const target = w / h;
  if (!iw || !ih || Math.abs(iw / ih - target) < 0.01) return src;
  // Crop keeps the image's short side and cuts the long one; pad keeps
  // the whole image and grows the short side.
  const wider = iw / ih > target;
  const keepHeight = fit === "crop" ? wider : !wider;
  canvas.width = keepHeight ? Math.round(ih * target) : iw;
  canvas.height = keepHeight ? ih : Math.round(iw / target);
  if (fit === "pad") {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, (canvas.width - iw) / 2, (canvas.height - ih) / 2);
  try {
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    // A cross-origin image without CORS can't be read back: send it as is.
    return src;
  }
}

/** The attachments with each image fitted to `ratio`; other media unchanged. */
export function fitImagesToRatio(attachments: DroppedMedia[], ratio: string, fit: StartImageFit): Promise<DroppedMedia[]> {
  return Promise.all(
    attachments.map(async (a) => (a.kind === "image" ? { ...a, src: await fitImageToRatio(a.src, ratio, fit) } : a))
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
