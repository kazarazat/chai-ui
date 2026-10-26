/**
 * Entirely mocked — no network call, no API key, per the project rule that
 * provider integration tests stay mocked by default. `fetchImpl` is
 * injected so nothing here ever reaches ai-gateway.vercel.sh.
 */
import { describe, expect, it, vi } from "vitest";
import { createVercelEngine, pingVercel } from "./vercel.js";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

describe("createVercelEngine (text)", () => {
  it("posts a chat request to the same-origin /chat route and returns the reply", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json({ choices: [{ message: { content: "A cat." } }], usage: { prompt_tokens: 10, completion_tokens: 2 } })
    );
    const engine = createVercelEngine({ fetchImpl });
    const out = await engine.generate({ modelId: "anthropic/claude-opus-5", prompt: "describe", attachments: [] });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/chai/vercel/chat");
    expect(JSON.parse(init.body).model).toBe("anthropic/claude-opus-5");
    expect(out).toMatchObject({ src: "A cat.", kind: "text", usage: { promptTokens: 10, completionTokens: 2 } });
  });

  it("streams through onText when asked, reading the same SSE shape as OpenRouter", async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n';
    const fetchImpl = vi.fn().mockResolvedValue(new Response(sse, { status: 200 }));
    const seen: string[] = [];
    const out = await createVercelEngine({ fetchImpl, model: "openai/gpt-6-astra" }).generate({
      prompt: "hi",
      attachments: [],
      onText: (t) => seen.push(t),
    });

    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).stream).toBe(true);
    expect(seen.at(-1)).toBe("Hello");
    expect(out.src).toBe("Hello");
  });

  it("refuses to run without a model, rather than guessing one", async () => {
    const fetchImpl = vi.fn();
    await expect(createVercelEngine({ fetchImpl }).generate({ prompt: "x", attachments: [] })).rejects.toThrow(
      /no model configured for outputKind "text"/
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces the gateway's own error message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json({ error: { message: "Model not found" } }, { status: 404, statusText: "Not Found" })
    );
    await expect(
      createVercelEngine({ fetchImpl, model: "x/y" }).generate({ prompt: "x", attachments: [] })
    ).rejects.toThrow("vercelEngine: Model not found");
  });
});

describe("createVercelEngine (image)", () => {
  it("posts to /images and returns a base64 image as a data URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ data: [{ b64_json: "iVBORw0KGgo=" }] }));
    const out = await createVercelEngine({ fetchImpl, outputKind: "image", model: "bfl/flux-pro-1.1" }).generate({
      prompt: "a mug",
      attachments: [],
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/chai/vercel/images");
    expect(JSON.parse(init.body)).toEqual({ model: "bfl/flux-pro-1.1", prompt: "a mug", n: 1 });
    expect(out).toEqual({ src: "data:image/png;base64,iVBORw0KGgo=", kind: "image" });
  });

  it("uses a hosted url when the gateway returns one", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ data: [{ url: "https://cdn.test/a.png" }] }));
    const out = await createVercelEngine({ fetchImpl, outputKind: "image", model: "m" }).generate({
      prompt: "x",
      attachments: [],
    });
    expect(out.src).toBe("https://cdn.test/a.png");
  });

  it("rejects attachments, since the images endpoint takes a prompt only", async () => {
    const fetchImpl = vi.fn();
    await expect(
      createVercelEngine({ fetchImpl, outputKind: "image", model: "m" }).generate({
        prompt: "x",
        attachments: [{ kind: "image", src: "data:image/png;base64,AAAA" } as never],
      })
    ).rejects.toThrow(/prompt only/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails clearly when the reply has no image", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ data: [] }));
    await expect(
      createVercelEngine({ fetchImpl, outputKind: "image", model: "m" }).generate({ prompt: "x", attachments: [] })
    ).rejects.toThrow("no image in the AI Gateway's response");
  });
});

describe("pingVercel", () => {
  it("asks the named model for one word through the route, and reports its reply", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ choices: [{ message: { content: " OK " } }] }));
    await expect(pingVercel({ model: "openai/gpt-5-mini", endpoint: "/chai/vercel/", fetchImpl })).resolves.toEqual({ ok: true, reply: "OK" });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/chai/vercel/chat");
    expect(JSON.parse(init.body)).toMatchObject({ model: "openai/gpt-5-mini", max_tokens: 5 });
  });

  it("reports the gateway's error, or the status when it sends none", async () => {
    const rejected = vi.fn().mockResolvedValue(json({ error: { message: "Add a card to use the AI Gateway." } }, { status: 402 }));
    await expect(pingVercel({ model: "m", fetchImpl: rejected })).resolves.toEqual({
      ok: false,
      error: expect.stringContaining("Add a card to use the AI Gateway."),
    });

    const bare = vi.fn().mockResolvedValue(new Response("not json", { status: 503, statusText: "Service Unavailable" }));
    await expect(pingVercel({ model: "m", fetchImpl: bare })).resolves.toEqual({ ok: false, error: expect.stringContaining("503") });
  });

  it("reports ok:false instead of throwing when the route can't be reached", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(pingVercel({ model: "m", fetchImpl })).resolves.toEqual({ ok: false, error: "Failed to fetch" });
    const odd = vi.fn().mockRejectedValue("offline");
    await expect(pingVercel({ model: "m", fetchImpl: odd })).resolves.toEqual({ ok: false, error: "offline" });
  });

  it("reads an empty reply as empty", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ choices: [] }));
    await expect(pingVercel({ model: "m", fetchImpl })).resolves.toEqual({ ok: true, reply: "" });
  });
});
