import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFilename, downloadMedia, shareMedia } from "./media-actions.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloadMedia", () => {
  it("fetches the media into a blob and downloads it under the given name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(["x"])) }));
    const createObjectURL = vi.fn(() => "blob:media");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe("blob:media");
      expect(this.download).toBe("image-r1.png");
    });

    await downloadMedia("https://cdn.example/a.png", "image-r1.png");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:media");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("opens the media instead when it can't be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("CORS")));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await downloadMedia("https://cdn.example/a.png", "a.png");
    expect(open).toHaveBeenCalledWith("https://cdn.example/a.png", "_blank", "noopener");
  });
});

describe("shareMedia", () => {
  it("uses the share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    await shareMedia("https://cdn.example/a.png");
    expect(share).toHaveBeenCalledWith({ url: "https://cdn.example/a.png" });
  });

  it("treats a dismissed share sheet as done, and reports it", async () => {
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")) });
    await expect(shareMedia("https://cdn.example/a.png")).resolves.toBe("none");
  });

  it("reports a completed share", async () => {
    vi.stubGlobal("navigator", { share: vi.fn().mockResolvedValue(undefined) });
    await expect(shareMedia("https://cdn.example/a.png")).resolves.toBe("shared");
  });

  it("copies the link where there's no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(shareMedia("https://cdn.example/a.png")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://cdn.example/a.png");
  });
});

describe("downloadFilename", () => {
  it("keeps the URL's own extension", () => {
    expect(downloadFilename("r1", "image", "https://cdn.example/out.webp?sig=1")).toBe("image-r1.webp");
  });

  it("guesses one by kind otherwise", () => {
    expect(downloadFilename("r", "video", "blob:x")).toBe("video-r.mp4");
    expect(downloadFilename("r", "audio", "blob:x")).toBe("audio-r.mp3");
    expect(downloadFilename("r", "text", "data:x")).toBe("text-r.txt");
    expect(downloadFilename("r", "image", "data:x")).toBe("image-r.png");
  });
});
