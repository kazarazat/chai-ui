import { afterEach, describe, expect, it, vi } from "vitest";
import { createChaiHandler } from "./chai-handler.js";
import { toNodeHandler } from "./node.js";

const ok = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const post = (path: string, body: unknown) =>
  new Request(`https://app.test${path}`, { method: "POST", body: JSON.stringify(body) });

afterEach(() => vi.unstubAllEnvs());

describe("createChaiHandler", () => {
  it("forwards an OpenRouter chat call with the key added, and passes the reply through", async () => {
    const fetch = vi.fn().mockResolvedValue(ok({ choices: [{ message: { content: "hi" } }] }));
    const chai = createChaiHandler({ openRouterKey: "or-key", fetch });
    const res = await chai.POST(post("/api/chai/openrouter/chat", { model: "anthropic/claude-opus-5" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ choices: [{ message: { content: "hi" } }] });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer or-key");
    expect(JSON.parse(init.body).model).toBe("anthropic/claude-opus-5");
  });

  it("forwards Fal queue submits and polls to queue.fal.run with the key", async () => {
    const fetch = vi.fn().mockResolvedValue(ok({ request_id: "r1" }));
    const chai = createChaiHandler({ falKey: "fal-key", fetch });
    await chai.POST(post("/api/chai/fal/fal-ai/flux/schnell", { prompt: "mug" }));
    await chai.GET(new Request("https://app.test/api/chai/fal/fal-ai/flux/schnell/requests/r1/status"));

    expect(fetch.mock.calls[0]![0]).toBe("https://queue.fal.run/fal-ai/flux/schnell");
    expect(fetch.mock.calls[0]![1].headers.Authorization).toBe("Key fal-key");
    expect(fetch.mock.calls[1]![0]).toBe("https://queue.fal.run/fal-ai/flux/schnell/requests/r1/status");
    expect(fetch.mock.calls[1]![1].method).toBe("GET");
  });

  it("reads keys from the environment by default", async () => {
    vi.stubEnv("FAL_KEY", "env-fal");
    const fetch = vi.fn().mockResolvedValue(ok({}));
    await createChaiHandler({ fetch }).POST(post("/api/chai/fal/fal-ai/flux", {}));
    expect(fetch.mock.calls[0]![1].headers.Authorization).toBe("Key env-fal");
  });

  it("explains a missing key in each engine's own error shape", async () => {
    vi.stubEnv("FAL_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const chai = createChaiHandler({ fetch: vi.fn() });
    const fal = await chai.POST(post("/api/chai/fal/fal-ai/flux", {}));
    const or = await chai.POST(post("/api/chai/openrouter/chat", { model: "x" }));
    expect(fal.status).toBe(500);
    expect(await fal.json()).toEqual({ error: "FAL_KEY isn't set on the server." });
    expect(await or.json()).toEqual({ error: { message: "OPENROUTER_API_KEY isn't set on the server." } });
  });

  it("rejects with 403 when authorize says no, without calling the provider", async () => {
    const fetch = vi.fn();
    const chai = createChaiHandler({ openRouterKey: "k", fetch, authorize: (req) => req.headers.get("x-user") === "me" });
    const res = await chai.POST(post("/api/chai/openrouter/chat", { model: "x" }));
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("only runs allowed models, checked in the body for OpenRouter and the path for Fal", async () => {
    const fetch = vi.fn().mockResolvedValue(ok({}));
    const chai = createChaiHandler({
      falKey: "f",
      openRouterKey: "o",
      fetch,
      allowedModels: ["fal-ai/flux/schnell", "anthropic/claude-opus-5"],
    });
    expect((await chai.POST(post("/api/chai/openrouter/chat", { model: "openai/o9-pro" }))).status).toBe(403);
    expect((await chai.POST(post("/api/chai/fal/fal-ai/flux-pro", {}))).status).toBe(403);
    expect((await chai.POST(post("/api/chai/openrouter/chat", { model: "anthropic/claude-opus-5" }))).status).toBe(200);
    expect((await chai.GET(new Request("https://app.test/api/chai/fal/fal-ai/flux/schnell/requests/r/status"))).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("works at any mount path, and 404s anything else", async () => {
    const fetch = vi.fn().mockResolvedValue(ok({}));
    const chai = createChaiHandler({ openRouterKey: "o", fetch });
    expect((await chai.POST(post("/custom/prefix/openrouter/chat", { model: "x" }))).status).toBe(200);
    expect((await chai.POST(post("/api/chai/somewhere", {}))).status).toBe(404);
  });

  it("streams the provider's body through untouched", async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("data: a\n\n"));
        c.enqueue(new TextEncoder().encode("data: b\n\n"));
        c.close();
      },
    });
    const fetch = vi.fn().mockResolvedValue(new Response(stream, { headers: { "content-type": "text/event-stream" } }));
    const res = await createChaiHandler({ openRouterKey: "o", fetch }).POST(post("/api/chai/openrouter/chat", { model: "x" }));
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(await res.text()).toBe("data: a\n\ndata: b\n\n");
  });

  it("returns 502 with the reason when the provider can't be reached", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await createChaiHandler({ openRouterKey: "o", fetch }).POST(post("/api/chai/openrouter/chat", { model: "x" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error.message).toMatch(/Couldn't reach OpenRouter: ECONNREFUSED/);
  });
});

describe("toNodeHandler", () => {
  it("runs the handler on Node-style req/res, using Express's originalUrl", async () => {
    const fetch = vi.fn().mockResolvedValue(ok({ ok: true }));
    const node = toNodeHandler(createChaiHandler({ openRouterKey: "o", fetch }));
    const body = JSON.stringify({ model: "x" });
    const req = Object.assign(
      (async function* () {
        yield new TextEncoder().encode(body);
      })(),
      { method: "POST", url: "/chat", originalUrl: "/api/chai/openrouter/chat", headers: { host: "app.test" } }
    );
    const written: Uint8Array[] = [];
    const res = { statusCode: 0, headers: {} as Record<string, string>, setHeader(n: string, v: string) { this.headers[n] = v; }, write(c: Uint8Array) { written.push(c); }, end: vi.fn() };

    await node(req, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ model: "x" });
    expect(new TextDecoder().decode(written[0])).toBe('{"ok":true}');
    expect(res.end).toHaveBeenCalled();
  });
});
