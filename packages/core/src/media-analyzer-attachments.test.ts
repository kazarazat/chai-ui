// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  isMediaAnalyzerAtCap,
  mediaAnalyzerModelSections,
  nextMediaAnalyzerAttachments,
  readMediaFiles,
  replacedNote,
  type MediaAnalyzerAttachment,
} from "./media-analyzer.js";

const at = (id: string, kind: "image" | "video" | "audio", name?: string): MediaAnalyzerAttachment => ({ id, kind, src: id, name });

describe("MediaAnalyzer attachments", () => {
  it("adds images up to the cap, replaces video and audio, and swaps kinds", () => {
    let list: MediaAnalyzerAttachment[] = [];
    for (let i = 0; i < 6; i++) list = nextMediaAnalyzerAttachments(list, { kind: "image", src: `i${i}` });
    expect(list).toHaveLength(5);
    expect(isMediaAnalyzerAtCap(list)).toBe(true);

    const clip = nextMediaAnalyzerAttachments(list, { kind: "video", src: "v1" });
    expect(clip.map((a) => a.src)).toEqual(["v1"]);
    expect(nextMediaAnalyzerAttachments(clip, { kind: "video", src: "v2" }).map((a) => a.src)).toEqual(["v2"]);
    expect(isMediaAnalyzerAtCap(clip)).toBe(false);
  });

  it("says what a new kind replaced", () => {
    const before = [at("a", "image"), at("b", "image")];
    expect(replacedNote(before, [at("c", "audio", "clip.wav")])).toBe("Replaced 2 images with clip.wav.");
    expect(replacedNote([at("a", "video")], [at("c", "audio")])).toBe("Replaced video with audio.");
    expect(replacedNote(before, [...before, at("c", "image")])).toBeNull();
  });

  it("lists every kind's models until one is attached, then only that kind's", () => {
    const m = (id: string) => ({ id, label: id, provider: "p", speed: "fast" as const });
    const byKind = { image: [m("img")], video: [m("vid")] };
    expect(mediaAnalyzerModelSections(undefined, byKind, []).map((s) => [s.label, s.options.length])).toEqual([
      ["Image", 1],
      ["Video", 1],
      ["Audio", 0],
    ]);
    expect(mediaAnalyzerModelSections("audio", byKind, [m("fallback")])).toEqual([{ label: "Audio", options: [{ id: "fallback", label: "fallback" }] }]);
  });

  it("reads media files as data URLs and names the rest", async () => {
    const { media, unsupported } = await readMediaFiles([
      new File(["x"], "photo.png", { type: "image/png" }),
      new File(["x"], "notes.txt", { type: "text/plain" }),
    ]);
    expect(media).toEqual([expect.objectContaining({ kind: "image", name: "photo.png", size: 1, src: expect.stringMatching(/^data:image\/png/) })]);
    expect(unsupported).toEqual(["notes.txt"]);
  });
});
