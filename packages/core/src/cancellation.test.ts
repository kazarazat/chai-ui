/** Cancellation across the engines, the run model and the server route. All mocked: no network. */
import { describe, expect, it, vi } from "vitest";
import { createMockEngine, isAbortError } from "./engine.js";
import { createFalEngine } from "./engines/fal.js";
import { createOpenRouterEngine } from "./engines/openrouter.js";
import { cancelResult, createRun, resolveResult, startResult } from "./run.js";
import { createChaiHandler } from "./server/chai-handler.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createFalEngine cancellation", () => {
  it("on abort while polling, sends Fal's cancel call and rejects with an AbortError", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json({ request_id: "req_1", status: "IN_QUEUE" });
      if (init?.method === "PUT") return json({ status: "CANCELLATION_REQUESTED" }, 202);
      return json({ status: "IN_QUEUE" });
    });
    const engine = createFalEngine({ fetchImpl, pollIntervalMs: 20 });
    const pending = engine.generate({ prompt: "mug", attachments: [], signal: controller.signal });
    await new Promise((r) => setTimeout(r, 30));
    controller.abort();

    const err = await pending.catch((e) => e);
    expect(isAbortError(err)).toBe(true);
    const cancel = fetchImpl.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(cancel[0]).toBe("/api/chai/fal/fal-ai/flux/schnell/requests/req_1/cancel");
  });

  it("cancels right after submit when stopped during the submit call", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        controller.abort();
        return json({ request_id: "req_2" });
      }
      return json({});
    });
    const err = await createFalEngine({ fetchImpl })
      .generate({ prompt: "mug", attachments: [], signal: controller.signal })
      .catch((e) => e);
    expect(isAbortError(err)).toBe(true);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "PUT"]);
  });

  it("doesn't submit at all when already stopped", async () => {
    const fetchImpl = vi.fn();
    const signal = AbortSignal.abort();
    const err = await createFalEngine({ fetchImpl }).generate({ prompt: "mug", attachments: [], signal }).catch((e) => e);
    expect(isAbortError(err)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("createOpenRouterEngine cancellation", () => {
  it("passes the signal to fetch, so aborting closes the stream", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
      );
    });
    const pending = createOpenRouterEngine({ fetchImpl }).generate({
      prompt: "hi",
      attachments: [],
      onText: () => {},
      signal: controller.signal,
    });
    controller.abort();
    expect(isAbortError(await pending.catch((e) => e))).toBe(true);
    expect(fetchImpl.mock.calls[0]![1]!.signal).toBe(controller.signal);
  });
});

describe("createMockEngine cancellation", () => {
  it("stops waiting and rejects with an AbortError", async () => {
    const controller = new AbortController();
    const pending = createMockEngine().generate({ prompt: "x", attachments: [], signal: controller.signal });
    controller.abort();
    expect(isAbortError(await pending.catch((e) => e))).toBe(true);
  });
});

describe("cancelResult", () => {
  it("marks a running result cancelled and leaves a settled one alone", () => {
    let run = createRun({ mode: "text-to-image", prompt: "x", attachments: [], modelIds: ["a", "b"], params: {} });
    const [a, b] = run.results;
    run = startResult(run, a!.id);
    run = resolveResult(run, b!.id, { src: "s", kind: "image" });
    run = cancelResult(cancelResult(run, a!.id), b!.id);
    expect(run.results[0]!.status).toBe("cancelled");
    expect(run.results[1]!.status).toBe("done");
  });
});

describe("createChaiHandler cancellation", () => {
  it("passes Fal's PUT cancel through", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ status: "CANCELLATION_REQUESTED" }, 202));
    const res = await createChaiHandler({ falKey: "k", fetch }).PUT(
      new Request("https://app.test/api/chai/fal/fal-ai/flux/schnell/requests/r1/cancel", { method: "PUT" })
    );
    expect(res.status).toBe(202);
    expect(fetch.mock.calls[0]![0]).toBe("https://queue.fal.run/fal-ai/flux/schnell/requests/r1/cancel");
    expect(fetch.mock.calls[0]![1].method).toBe("PUT");
  });

  it("rejects other PUTs", async () => {
    const res = await createChaiHandler({ falKey: "k", fetch: vi.fn() }).PUT(
      new Request("https://app.test/api/chai/fal/fal-ai/flux", { method: "PUT" })
    );
    expect(res.status).toBe(405);
  });

  it("aborts the provider call when the browser's request is aborted", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(json({}));
    await createChaiHandler({ openRouterKey: "k", fetch }).POST(
      new Request("https://app.test/api/chai/openrouter/chat", { method: "POST", body: "{}", signal: controller.signal })
    );
    const passed: AbortSignal = fetch.mock.calls[0]![1].signal;
    expect(passed.aborted).toBe(false);
    controller.abort();
    expect(passed.aborted).toBe(true);
  });
});
