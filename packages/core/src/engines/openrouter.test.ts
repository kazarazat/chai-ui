/**
 * Entirely mocked — no network call, no API key, per the project rule that
 * OpenRouter integration tests stay mocked by default. `fetchImpl` is
 * injected so nothing here ever reaches openrouter.ai. The one real-network
 * check (`pingOpenRouter`, live) is a manual UI action, not a test.
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildChatRequest,
  contentPartForMedia,
  createOpenRouterEngine,
  pingOpenRouter,
  readChatStream,
} from "./openrouter.js";

describe("contentPartForMedia", () => {
  it("builds an image_url part for image media", () => {
    expect(
      contentPartForMedia({ src: "data:image/png;base64,AAA", kind: "image" })
    ).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAA" } });
  });

  it("builds a video_url part for video media", () => {
    expect(contentPartForMedia({ src: "https://example.com/clip.mp4", kind: "video" })).toEqual({
      type: "video_url",
      video_url: { url: "https://example.com/clip.mp4" },
    });
  });

  it("builds an input_audio part for audio media, splitting the data URL", () => {
    expect(
      contentPartForMedia({ src: "data:audio/mpeg;base64,BBB", kind: "audio" })
    ).toEqual({ type: "input_audio", input_audio: { data: "BBB", format: "mpeg" } });
  });

  it("rejects audio that isn't a base64 data URL", () => {
    expect(() =>
      contentPartForMedia({ src: "https://example.com/clip.mp3", kind: "audio" })
    ).toThrow(/base64 data URL/);
  });
});

describe("buildChatRequest", () => {
  it("puts text before the media part, per OpenRouter's ordering guidance", () => {
    const body = buildChatRequest({
      model: "vision-fast",
      prompt: "Describe this.",
      media: [{ src: "data:image/png;base64,AAA", kind: "image" }],
    });
    expect(body.messages[0]!.content[0]).toEqual({ type: "text", text: "Describe this." });
    expect(body.messages[0]!.content[1]).toMatchObject({ type: "image_url" });
  });

  it("omits the media part when there's no attached media", () => {
    const body = buildChatRequest({ model: "vision-fast", prompt: "Describe this." });
    expect(body.messages[0]!.content).toHaveLength(1);
  });

  it("always sends a max_tokens cap — some providers reject an uncapped request outright", () => {
    expect(buildChatRequest({ model: "vision-fast", prompt: "Describe this." }).max_tokens).toBeGreaterThan(0);
    expect(
      buildChatRequest({ model: "vision-fast", prompt: "Describe this.", maxTokens: 42 }).max_tokens
    ).toBe(42);
  });
});

describe("createOpenRouterEngine", () => {
  it("posts to the local proxy (never openrouter.ai directly) with the kind-appropriate model", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "a red mug on a table" } }] }),
    });
    const engine = createOpenRouterEngine({ fetchImpl, modelByKind: { image: "vision-fast" } });

    const result = await engine.generate({
      prompt: "Analyze the attached image...",
      attachments: [{ src: "data:image/png;base64,AAA", kind: "image" }],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/chai/openrouter/chat");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("vision-fast");
    expect(result).toEqual({ src: "a red mug on a table", kind: "text" });
  });

  it("calls the caller's modelId over modelByKind and the default", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    const engine = createOpenRouterEngine({ fetchImpl, modelByKind: { image: "vision-fast" } });

    await engine.generate({
      modelId: "picked/model",
      prompt: "Describe these.",
      attachments: [{ src: "data:image/png;base64,AAA", kind: "image" }],
    });

    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).model).toBe("picked/model");
  });

  it("sends every attachment, not just the first", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    const engine = createOpenRouterEngine({ fetchImpl });

    await engine.generate({
      prompt: "Describe these.",
      attachments: [
        { src: "data:image/png;base64,AAA", kind: "image" },
        { src: "data:image/png;base64,BBB", kind: "image" },
      ],
    });

    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).messages[0].content).toHaveLength(3);
  });

  it("surfaces OpenRouter error responses instead of throwing an opaque failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { message: "Invalid API key" } }),
    });
    const engine = createOpenRouterEngine({ fetchImpl });

    await expect(
      engine.generate({
        prompt: "Analyze the attached image...",
        attachments: [{ src: "data:image/png;base64,AAA", kind: "image" }],
      })
    ).rejects.toThrow(/Invalid API key/);
  });

  it("surfaces the upstream provider's specific error, not just OpenRouter's generic wrapper", async () => {
    // Shape actually observed live: OpenRouter's own message is a
    // near-useless "Provider returned error"; the actionable detail is
    // nested as a JSON string in error.metadata.raw.
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({
        error: {
          message: "Provider returned error",
          metadata: { raw: '{"error":{"message":"Provided image is not valid."}}' },
        },
      }),
    });
    const engine = createOpenRouterEngine({ fetchImpl });

    await expect(
      engine.generate({
        prompt: "Analyze the attached image...",
        attachments: [{ src: "data:image/png;base64,AAA", kind: "image" }],
      })
    ).rejects.toThrow(/Provided image is not valid/);
  });
});

describe("pingOpenRouter", () => {
  it("reports ok:true with the model's reply on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "OK" } }] }),
    });
    await expect(pingOpenRouter({ fetchImpl })).resolves.toEqual({ ok: true, reply: "OK" });
  });

  it("reports ok:false instead of throwing when the proxy or key isn't set up", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(pingOpenRouter({ fetchImpl })).resolves.toEqual({
      ok: false,
      error: "Failed to fetch",
    });
  });
});

/** A `Response` whose body arrives as the given chunks — split mid-line on purpose, the way real network reads land. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("readChatStream", () => {
  it("accumulates deltas across chunk boundaries, skipping keep-alives and [DONE]", async () => {
    const onText = vi.fn();
    const { text, usage } = await readChatStream(
      sseResponse([
        ": OPENROUTER PROCESSING\n\n",
        'data: {"choices":[{"delta":{"content":"a red"}}]}\n\ndata: {"choi',
        'ces":[{"delta":{"content":" mug"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}\n\n',
        "data: [DONE]\n\n",
      ]),
      onText
    );
    expect(text).toBe("a red mug");
    expect(onText.mock.calls.map(([t]) => t)).toEqual(["a red", "a red mug"]);
    expect(usage).toEqual({ prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 });
  });

  it("throws on a mid-stream error chunk", async () => {
    await expect(
      readChatStream(sseResponse(['data: {"error":{"message":"Provider returned error"}}\n\n']), () => {})
    ).rejects.toThrow(/Provider returned error/);
  });
});

describe("createOpenRouterEngine streaming", () => {
  it("asks for a stream only when onText is passed, and returns the full text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      sseResponse(['data: {"choices":[{"delta":{"content":"hello"}}]}\n\n', "data: [DONE]\n\n"])
    );
    const onText = vi.fn();
    const result = await createOpenRouterEngine({ fetchImpl }).generate({ prompt: "hi", attachments: [], onText });

    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).stream).toBe(true);
    expect(onText).toHaveBeenCalledWith("hello");
    expect(result).toMatchObject({ src: "hello", kind: "text" });
  });

  it("still surfaces a rejected request's JSON error when streaming was asked for", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      statusText: "Payment Required",
      json: async () => ({ error: { message: "Insufficient credits" } }),
    });
    await expect(
      createOpenRouterEngine({ fetchImpl }).generate({ prompt: "hi", attachments: [], onText: () => {} })
    ).rejects.toThrow(/Insufficient credits/);
  });

  it("doesn't set stream when no onText is passed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    await createOpenRouterEngine({ fetchImpl }).generate({ prompt: "hi", attachments: [] });
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).stream).toBeUndefined();
  });
});

describe("createOpenRouterEngine evaluations", () => {
  it("passes through verdicts the backend proxy appended to the JSON response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
        evaluations: [{ id: "tone", label: "On brand", passed: true }],
      }),
    });
    const result = await createOpenRouterEngine({ fetchImpl }).generate({ prompt: "hi", attachments: [] });
    expect(result.evaluations).toEqual([{ id: "tone", label: "On brand", passed: true }]);
  });

  it("reads verdicts from a stream's own chunk", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
        'data: {"evaluations":[{"id":"tone","label":"On brand","passed":false}]}\n\n',
        "data: [DONE]\n\n",
      ])
    );
    const result = await createOpenRouterEngine({ fetchImpl }).generate({ prompt: "hi", attachments: [], onText: () => {} });
    expect(result.evaluations).toEqual([{ id: "tone", label: "On brand", passed: false }]);
  });
});
