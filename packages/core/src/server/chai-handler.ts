/**
 * `createChaiHandler`: the one server route the built-in engines call.
 * The browser never sees an API key. `createFalEngine()` and
 * `createOpenRouterEngine()` post to this route (default `/api/chai/...`),
 * and it adds the key and forwards the request to the provider.
 *
 * Built on the web-standard `Request` → `Response`, so the same handler
 * runs in Next.js, React Router (Remix), Hono, Cloudflare Workers, Bun and
 * Deno. `toNodeHandler` (./node.ts) adapts it for Express and plain Node.
 */

const FAL_QUEUE_BASE = "https://queue.fal.run";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChaiProviderId = "fal" | "openrouter";

export interface ChaiHandlerOptions {
  /** Defaults to the `FAL_KEY` environment variable. */
  falKey?: string;
  /** Defaults to the `OPENROUTER_API_KEY` environment variable. */
  openRouterKey?: string;
  /**
   * Who may use this route. Return false to reject with 403. Without it,
   * anyone who can reach your site can spend your API credit: check your
   * own login or session here before going live.
   */
  authorize?: (request: Request) => boolean | Promise<boolean>;
  /**
   * The only model ids this route will run, across both providers (e.g.
   * `"fal-ai/flux/schnell"`, `"anthropic/claude-opus-5"`). Anything else is
   * rejected with 403, so nobody can run an expensive model through you.
   * Omit to allow every model.
   */
  allowedModels?: string[];
  /** Injectable for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export interface ChaiHandler {
  /** Handles any request under the route. */
  handle: (request: Request) => Promise<Response>;
  /** The same function, named for frameworks that export one per method (Next.js). */
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  /** Fal's cancel call. */
  PUT: (request: Request) => Promise<Response>;
}

export function createChaiHandler(options: ChaiHandlerOptions = {}): ChaiHandler {
  const fetchImpl = options.fetch ?? fetch;

  async function handle(request: Request): Promise<Response> {
    const route = parseRoute(new URL(request.url).pathname);
    if (!route) {
      return Response.json(
        { error: { message: "chai-handler: expected a path ending in /fal/<model…> or /openrouter/chat." } },
        { status: 404 }
      );
    }
    const fail = (status: number, message: string) => errorResponse(route.provider, status, message);

    if (options.authorize && !(await options.authorize(request))) return fail(403, "Not authorized.");

    if (route.provider === "openrouter") {
      if (route.rest !== "chat") return fail(404, `Unknown OpenRouter path "${route.rest}".`);
      if (request.method !== "POST") return fail(405, "Use POST.");
      const key = options.openRouterKey ?? readEnv("OPENROUTER_API_KEY");
      if (!key) return fail(500, "OPENROUTER_API_KEY isn't set on the server.");
      const body = await request.text();
      const model = readModel(body);
      if (options.allowedModels && !(model && options.allowedModels.includes(model))) {
        return fail(403, `Model "${model ?? "(none)"}" isn't allowed on this server.`);
      }
      return forward(fetchImpl, route.provider, OPENROUTER_CHAT_URL, {
        signal: request.signal,
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
      });
    }

    // Fal's queue API: POST /<model> submits, GET /<model>/requests/<id>[/status]
    // polls, PUT /<model>/requests/<id>/cancel cancels.
    const isCancel = request.method === "PUT" && route.rest.endsWith("/cancel");
    if (request.method !== "GET" && request.method !== "POST" && !isCancel) return fail(405, "Use GET or POST.");
    const key = options.falKey ?? readEnv("FAL_KEY");
    if (!key) return fail(500, "FAL_KEY isn't set on the server.");
    if (options.allowedModels && !options.allowedModels.some((m) => route.rest === m || route.rest.startsWith(`${m}/`))) {
      return fail(403, `Model "${falModel(route.rest)}" isn't allowed on this server.`);
    }
    return forward(fetchImpl, route.provider, `${FAL_QUEUE_BASE}/${route.rest}${new URL(request.url).search}`, {
      signal: request.signal,
      method: request.method,
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
    });
  }

  return { handle, GET: handle, POST: handle, PUT: handle };
}

/** Finds the provider segment anywhere in the path, so the route can be mounted at any prefix. */
function parseRoute(pathname: string): { provider: ChaiProviderId; rest: string } | null {
  const parts = pathname.split("/").filter(Boolean);
  const i = parts.findIndex((p) => p === "fal" || p === "openrouter");
  if (i === -1 || i === parts.length - 1) return null;
  return { provider: parts[i] as ChaiProviderId, rest: parts.slice(i + 1).join("/") };
}

/** Passes the provider's response straight through, streaming included. */
async function forward(fetchImpl: typeof fetch, provider: ChaiProviderId, url: string, init: RequestInit): Promise<Response> {
  try {
    const upstream = await fetchImpl(url, init);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    return errorResponse(provider, 502, `Couldn't reach ${provider === "fal" ? "Fal.ai" : "OpenRouter"}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Errors in the shape each engine already reads: Fal's `{ error }`, OpenRouter's `{ error: { message } }`. */
function errorResponse(provider: ChaiProviderId, status: number, message: string): Response {
  const body = provider === "fal" ? { error: message } : { error: { message } };
  return Response.json(body, { status });
}

function readModel(body: string): string | undefined {
  try {
    const model = (JSON.parse(body) as { model?: unknown }).model;
    return typeof model === "string" ? model : undefined;
  } catch {
    return undefined;
  }
}

/** The model part of a Fal queue path, for error messages: everything before `/requests/`. */
function falModel(rest: string): string {
  return rest.split("/requests/")[0]!;
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[name] || undefined;
}
