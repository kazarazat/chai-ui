/**
 * Runs a `ChaiHandler` on Node's own request/response objects, for Express
 * and plain `http.createServer` (and dev servers built on them, like
 * Vite's). Typed structurally, so this package needs no Node types.
 */

import type { ChaiHandler } from "./chai-handler.js";

interface NodeRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  url?: string;
  /** Express keeps the full path here when the route is mounted at a prefix. */
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface NodeResponse {
  statusCode: number;
  writableEnded?: boolean;
  on?(event: "close", listener: () => void): unknown;
  setHeader(name: string, value: string): unknown;
  write(chunk: Uint8Array): unknown;
  end(chunk?: string | Uint8Array): unknown;
}

export function toNodeHandler(handler: ChaiHandler) {
  return async (req: NodeRequest, res: NodeResponse): Promise<void> => {
    const host = String(req.headers.host ?? "localhost");
    const url = new URL(req.originalUrl ?? req.url ?? "/", `http://${host}`);
    const method = req.method ?? "GET";
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    let body: Uint8Array<ArrayBuffer> | undefined;
    if (method !== "GET" && method !== "HEAD") {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
      body = concat(chunks);
    }

    // When the browser disconnects (e.g. the person pressed stop), abort the
    // provider call too, so a stream stops at the provider.
    const controller = new AbortController();
    res.on?.("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const response = await handler.handle(new Request(url, { method, headers, body, signal: controller.signal }));
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    if (!response.body) return void res.end();
    // Streamed through as it arrives, so streaming text renders live.
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } catch {
      // The provider stream was aborted because the browser left; nothing to send.
    }
    res.end();
  };
}

function concat(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
