/**
 * Entirely mocked — no network call, no API key, per the same project rule
 * `openrouter.test.ts` follows. `fetchImpl` is injected so nothing here
 * ever reaches queue.fal.run. The one real-network check (`pingFal`, live)
 * is a manual UI action, not a test.
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildFalRequestBody,
  createFalEngine,
  describeFalError,
  extractFalResultSrc,
  pingFal,
} from "./fal.js";

describe("buildFalRequestBody", () => {
  it("sends just a prompt when there's no attached media", () => {
    expect(buildFalRequestBody({ prompt: "a red mug" })).toEqual({ prompt: "a red mug" });
  });

  it("sends the words as `text` for a model whose schema asks for it, with the voice", () => {
    expect(buildFalRequestBody({ prompt: "Hello", model: "xai/tts/v1", voice: "eve", input: { prompt: "text" } })).toEqual({
      text: "Hello",
      voice: "eve",
    });
    expect(buildFalRequestBody({ prompt: "Hello", model: "fal-ai/kokoro/american-english", voice: "af_heart" })).toEqual({
      prompt: "Hello",
      voice: "af_heart",
    });
  });

  it("sends the aspect ratio as aspect_ratio", () => {
    expect(buildFalRequestBody({ prompt: "a red mug", model: "fal-ai/nano-banana-pro", aspectRatio: "16:9" })).toEqual({
      prompt: "a red mug",
      aspect_ratio: "16:9",
    });
  });

  it("sends FLUX models a named image_size, leaving out a ratio FLUX has no size for", () => {
    expect(buildFalRequestBody({ prompt: "a red mug", model: "fal-ai/flux/schnell", aspectRatio: "9:16" })).toEqual({
      prompt: "a red mug",
      image_size: "portrait_16_9",
    });
    expect(buildFalRequestBody({ prompt: "a red mug", model: "fal-ai/flux/schnell", aspectRatio: "21:9" })).toEqual({
      prompt: "a red mug",
    });
  });

  it("sends GPT Image models a pixel image_size", () => {
    expect(
      buildFalRequestBody({ prompt: "a red mug", model: "fal-ai/gpt-image-1/text-to-image", aspectRatio: "3:2" })
    ).toEqual({ prompt: "a red mug", image_size: "1536x1024" });
  });

  it("adds image_url for attached image media", () => {
    expect(
      buildFalRequestBody({
        prompt: "a red mug",
        attachments: [{ src: "https://example.com/mug.png", kind: "image" }],
      })
    ).toEqual({ prompt: "a red mug", image_url: "https://example.com/mug.png" });
  });

  it("ignores attached video/audio media — no known Fal field for either", () => {
    expect(
      buildFalRequestBody({ prompt: "a red mug", attachments: [{ src: "x", kind: "video" }] })
    ).toEqual({ prompt: "a red mug" });
  });

  it("sends every image as image_urls to a model that takes a list, the edited image first", () => {
    expect(
      buildFalRequestBody({
        prompt: "make it blue",
        model: "blackforestlabs/flux-3/edit-image",
        attachments: [
          { src: "a.png", kind: "image" },
          { src: "clip.mp4", kind: "video" },
          { src: "b.png", kind: "image" },
        ],
      })
    ).toEqual({ prompt: "make it blue", image_urls: ["a.png", "b.png"] });
  });
});

describe("extractFalResultSrc", () => {
  it("reads images[0].url for image output", () => {
    expect(extractFalResultSrc({ images: [{ url: "https://x/img.png" }] }, "image")).toBe(
      "https://x/img.png"
    );
  });

  it("reads video.url for video output", () => {
    expect(extractFalResultSrc({ video: { url: "https://x/clip.mp4" } }, "video")).toBe(
      "https://x/clip.mp4"
    );
  });

  it("reads audio.url or audio_url for audio output", () => {
    expect(extractFalResultSrc({ audio: { url: "https://x/a.mp3" } }, "audio")).toBe(
      "https://x/a.mp3"
    );
    expect(extractFalResultSrc({ audio_url: "https://x/b.mp3" }, "audio")).toBe(
      "https://x/b.mp3"
    );
  });
});

describe("describeFalError", () => {
  it("returns a string error as-is", () => {
    expect(describeFalError({ error: "bad request" }, "fallback")).toBe("bad request");
  });

  it("stringifies a structured detail object", () => {
    expect(describeFalError({ detail: [{ msg: "field required" }] }, "fallback")).toBe(
      JSON.stringify([{ msg: "field required" }])
    );
  });

  it("falls back when neither error nor detail is present", () => {
    expect(describeFalError({}, "500 Internal Server Error")).toBe("500 Internal Server Error");
  });
});

/** Three-call sequence every happy-path test below drives: submit, one status poll, then the result fetch. */
function mockThreeCallSequence(opts: {
  submitStatus?: string;
  pollStatus?: string;
  result: Record<string, unknown>;
}) {
  return vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ request_id: "req_1", status: opts.submitStatus ?? "IN_QUEUE" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: opts.pollStatus ?? "COMPLETED" }),
    })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => opts.result });
}

describe("createFalEngine", () => {
  it("submits to the local proxy (never queue.fal.run directly), polls, and returns the real image", async () => {
    const fetchImpl = mockThreeCallSequence({ result: { images: [{ url: "https://x/img.png" }] } });
    const engine = createFalEngine({ fetchImpl, pollIntervalMs: 0 });

    const result = await engine.generate({
      prompt: "a red mug on a table",
      attachments: [],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const [submitUrl, submitInit] = fetchImpl.mock.calls[0]!;
    expect(submitUrl).toBe("/api/chai/fal/fal-ai/flux/schnell");
    expect(JSON.parse(submitInit.body).prompt).toBe("a red mug on a table");
    const [statusUrl] = fetchImpl.mock.calls[1]!;
    expect(statusUrl).toBe("/api/chai/fal/fal-ai/flux/schnell/requests/req_1/status");
    const [resultUrl] = fetchImpl.mock.calls[2]!;
    expect(resultUrl).toBe("/api/chai/fal/fal-ai/flux/schnell/requests/req_1");
    expect(result).toEqual({ src: "https://x/img.png", kind: "image" });
  });

  it("sends a builder's own model its inputs in the fields its falInput names, with the voice", async () => {
    const fetchImpl = mockThreeCallSequence({ result: { audio: { url: "https://x/a.mp3" } } });
    const xai = { id: "xai/tts/v1", label: "xAI TTS", provider: "xAI", speed: "standard" as const, falInput: { prompt: "text" as const } };
    const engine = createFalEngine({ fetchImpl, pollIntervalMs: 0, outputKind: "audio", models: [xai] });

    const result = await engine.generate({ modelId: "xai/tts/v1", prompt: "Welcome back", attachments: [], voice: "eve" });

    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body)).toEqual({ text: "Welcome back", voice: "eve" });
    expect(result).toEqual({ src: "https://x/a.mp3", kind: "audio" });
  });

  it("runs a model as its withImages endpoint when images are attached, with the ratio only where that endpoint takes one", async () => {
    const photo = { src: "data:image/png;base64,AA", kind: "image" as const };
    const image = mockThreeCallSequence({ result: { images: [{ url: "https://x/img.png" }] } });
    await createFalEngine({ fetchImpl: image, pollIntervalMs: 0 }).generate({
      modelId: "fal-ai/nano-banana-pro",
      prompt: "a mug",
      attachments: [photo],
      aspectRatio: "4:5",
    });
    expect(image.mock.calls[0]![0]).toBe("/api/chai/fal/fal-ai/nano-banana-pro/edit");
    expect(JSON.parse(image.mock.calls[0]![1].body)).toEqual({ prompt: "a mug", aspect_ratio: "4:5", image_urls: [photo.src] });

    // MiniMax's image-to-video takes no ratio: the store already fitted the image to it.
    const video = mockThreeCallSequence({ result: { video: { url: "https://x/v.mp4" } } });
    await createFalEngine({ fetchImpl: video, pollIntervalMs: 0, outputKind: "video" }).generate({
      modelId: "minimax/h3-max/text-to-video",
      prompt: "it lifts off",
      attachments: [photo],
      aspectRatio: "16:9",
    });
    expect(video.mock.calls[0]![0]).toBe("/api/chai/fal/minimax/h3-max/image-to-video");
    expect(JSON.parse(video.mock.calls[0]![1].body)).toEqual({ prompt: "it lifts off", image_url: photo.src });
    expect(video.mock.calls[1]![0]).toBe("/api/chai/fal/minimax/h3-max/image-to-video/requests/req_1/status");

    // Without images, the model's own endpoint as before.
    const plain = mockThreeCallSequence({ result: { images: [{ url: "https://x/img.png" }] } });
    await createFalEngine({ fetchImpl: plain, pollIntervalMs: 0 }).generate({ modelId: "fal-ai/nano-banana-pro", prompt: "a mug", attachments: [], aspectRatio: "4:5" });
    expect(plain.mock.calls[0]![0]).toBe("/api/chai/fal/fal-ai/nano-banana-pro");
  });

  it("runs a builder's own model as its withImages endpoint, and drops a ratio that endpoint doesn't list", async () => {
    const photo = { src: "data:image/png;base64,AA", kind: "image" as const };
    const mine = { id: "me/t2v", label: "Mine", provider: "me", speed: "fast" as const, withImages: "me/i2v" };
    const mineWithImages = { id: "me/i2v", label: "Mine", provider: "me", speed: "fast" as const, aspectRatios: ["16:9"], falInput: { image: "start_image_url" as const } };
    const own = mockThreeCallSequence({ result: { video: { url: "https://x/v.mp4" } } });
    await createFalEngine({ fetchImpl: own, pollIntervalMs: 0, outputKind: "video", models: [mine, mineWithImages] }).generate({
      modelId: "me/t2v",
      prompt: "go",
      attachments: [photo],
      aspectRatio: "1:1",
    });
    expect(own.mock.calls[0]![0]).toBe("/api/chai/fal/me/i2v");
    expect(JSON.parse(own.mock.calls[0]![1].body)).toEqual({ prompt: "go", start_image_url: photo.src });

    // No ratio picked: none sent.
    const none = mockThreeCallSequence({ result: { video: { url: "https://x/v.mp4" } } });
    await createFalEngine({ fetchImpl: none, pollIntervalMs: 0, outputKind: "video", models: [mine, mineWithImages] }).generate({ modelId: "me/t2v", prompt: "go", attachments: [photo] });
    expect(JSON.parse(none.mock.calls[0]![1].body)).toEqual({ prompt: "go", start_image_url: photo.src });
  });

  it("passes through verdicts the backend proxy appended to the result", async () => {
    const fetchImpl = mockThreeCallSequence({
      result: {
        images: [{ url: "https://x/img.png" }],
        evaluations: [{ id: "brand", label: "Brand safe", passed: false }],
      },
    });
    const result = await createFalEngine({ fetchImpl, pollIntervalMs: 0 }).generate({ prompt: "a mug", attachments: [] });
    expect(result.evaluations).toEqual([{ id: "brand", label: "Brand safe", passed: false }]);
  });

  it("keeps polling while status is IN_PROGRESS, not just IN_QUEUE", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ request_id: "req_1", status: "IN_QUEUE" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "IN_PROGRESS" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "COMPLETED" }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ images: [{ url: "https://x/img.png" }] }),
      });
    const engine = createFalEngine({ fetchImpl, pollIntervalMs: 0 });

    const result = await engine.generate({
      prompt: "a red mug",
      attachments: [],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result.src).toBe("https://x/img.png");
  });

  it("uses modelByKind for the configured outputKind", async () => {
    const fetchImpl = mockThreeCallSequence({ result: { video: { url: "https://x/clip.mp4" } } });
    const engine = createFalEngine({
      fetchImpl,
      pollIntervalMs: 0,
      outputKind: "video",
      modelByKind: { video: "minimax/h3-max/text-to-video" },
    });

    const result = await engine.generate({
      prompt: "a mug spinning on a table",
      attachments: [],
    });

    expect(fetchImpl.mock.calls[0]![0]).toBe("/api/chai/fal/minimax/h3-max/text-to-video");
    expect(result).toEqual({ src: "https://x/clip.mp4", kind: "video" });
  });

  it("calls the caller's modelId over any configured default", async () => {
    const fetchImpl = mockThreeCallSequence({ result: { images: [{ url: "https://x/img.png" }] } });
    const engine = createFalEngine({ fetchImpl, pollIntervalMs: 0, model: "fal-ai/configured-default" });

    await engine.generate({ modelId: "fal-ai/picked-model", prompt: "a red mug", attachments: [] });

    expect(fetchImpl.mock.calls[0]![0]).toBe("/api/chai/fal/fal-ai/picked-model");
  });

  it("sends the first attached image as image_url", async () => {
    const fetchImpl = mockThreeCallSequence({ result: { video: { url: "https://x/clip.mp4" } } });
    const engine = createFalEngine({ fetchImpl, pollIntervalMs: 0, outputKind: "video" });

    await engine.generate({
      prompt: "make it spin",
      attachments: [{ src: "https://x/mug.png", kind: "image" }],
    });

    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).image_url).toBe("https://x/mug.png");
  });

  it("surfaces a Fal submit error instead of throwing an opaque failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "Invalid API key" }),
    });
    const engine = createFalEngine({ fetchImpl });

    await expect(
      engine.generate({
        prompt: "a red mug",
        attachments: [],
      })
    ).rejects.toThrow(/Invalid API key/);
  });

  it("times out rather than polling forever", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ request_id: "req_1", status: "IN_QUEUE" }),
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "IN_PROGRESS" }) });
    const engine = createFalEngine({ fetchImpl, pollIntervalMs: 0, timeoutMs: 0 });

    await expect(
      engine.generate({
        prompt: "a red mug",
        attachments: [],
      })
    ).rejects.toThrow(/timed out/);
  });

  it("throws when no model is configured for the requested outputKind", async () => {
    const fetchImpl = vi.fn();
    const engine = createFalEngine({ fetchImpl, outputKind: "audio" });

    await expect(
      engine.generate({
        prompt: "a calm piano melody",
        attachments: [],
      })
    ).rejects.toThrow(/no model configured for outputKind "audio"/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("pingFal", () => {
  it("reports ok:true with the generated image URL on success", async () => {
    const fetchImpl = mockThreeCallSequence({ result: { images: [{ url: "https://x/ping.png" }] } });
    await expect(pingFal({ fetchImpl })).resolves.toEqual({ ok: true, src: "https://x/ping.png" });
  });

  it("reports ok:false instead of throwing when the proxy or key isn't set up", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(pingFal({ fetchImpl })).resolves.toEqual({
      ok: false,
      error: "Failed to fetch",
    });
  });
});

describe("calling fetch", () => {
  it("never calls fetch with an object as `this` (browsers throw Illegal invocation)", async () => {
    const original = globalThis.fetch;
    const responses = [
      { request_id: "r1", status: "COMPLETED" },
      { images: [{ url: "https://x/img.png" }] },
    ];
    // Behaves like the browser's fetch: refuses any `this` but the global object.
    globalThis.fetch = function (this: unknown) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(new Response(JSON.stringify(responses.shift())));
    } as typeof fetch;
    try {
      const out = await createFalEngine({ pollIntervalMs: 0 }).generate({ prompt: "mug", attachments: [] });
      expect(out.src).toBe("https://x/img.png");
    } finally {
      globalThis.fetch = original;
    }
  });
});
