import type { MediaKind, ModelOption } from "./types.js";
import { SUGGESTED_ANALYSIS_MODELS, SUGGESTED_FAL_MODELS } from "./suggested-models.js";
import { FAL_NAMED_IMAGE_SIZES } from "./engines/fal.js";

/** One way a provider no longer matches a suggested model. */
export interface SuggestedModelProblem {
  provider: "fal" | "openrouter";
  /** The model's id, or `"*"` when the provider couldn't be reached at all. */
  modelId: string;
  problem: string;
}

export interface SuggestedModelsCheck {
  /** True when every suggested model still matches its provider. */
  ok: boolean;
  /** How many models were checked. */
  checked: number;
  problems: SuggestedModelProblem[];
}

/**
 * Checks the suggested model lists against Fal and OpenRouter as they are
 * today: each model still exists and is active; for Fal, it still takes
 * the aspect ratios and image field Chai sends, and needs no other field
 * Chai doesn't send; for OpenRouter, it still accepts the media kind it's
 * listed for. Run it while setting up your engine. It needs no API key,
 * runs no model and costs nothing; both catalogs are public and allow
 * calls from a browser.
 *
 * The lists themselves only change through package releases. A problem
 * here means a provider changed since: pick another model, or update the
 * package once a release catches up.
 */
export async function checkSuggestedModels(options: { fetchImpl?: typeof fetch } = {}): Promise<SuggestedModelsCheck> {
  const fetchImpl: typeof fetch = (input, init) => (options.fetchImpl ?? fetch)(input, init);
  const fal = [...SUGGESTED_FAL_MODELS.values()];
  const analysis = Object.entries(SUGGESTED_ANALYSIS_MODELS).flatMap(([kind, models]) =>
    (models ?? []).map((model) => ({ kind: kind as MediaKind, model }))
  );
  const problems = [...(await checkFal(fal, fetchImpl)), ...(await checkOpenRouter(analysis, fetchImpl))];
  return { ok: problems.length === 0, checked: fal.length + analysis.length, problems };
}

type Schema = { properties?: Record<string, Schema>; required?: string[]; enum?: unknown[]; const?: unknown; default?: unknown; anyOf?: Schema[]; allOf?: Schema[]; $ref?: string };

async function checkFal(models: ModelOption[], fetchImpl: typeof fetch): Promise<SuggestedModelProblem[]> {
  const query = models.map((m) => `endpoint_id=${encodeURIComponent(m.id)}`).join("&");
  let found: { endpoint_id: string; metadata?: { status?: string }; openapi?: OpenApi }[];
  try {
    // Fal answers 10 models a page, with a cursor for the next.
    found = [];
    let cursor: string | undefined;
    do {
      const res = await fetchImpl(
        `https://api.fal.ai/v1/models?expand=openapi-3.0&${query}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const page = (await res.json()) as { models?: typeof found; has_more?: boolean; next_cursor?: string };
      found.push(...(page.models ?? []));
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
  } catch (err) {
    return [{ provider: "fal", modelId: "*", problem: `Couldn't reach Fal's model catalog: ${(err as Error).message}` }];
  }

  const problems: SuggestedModelProblem[] = [];
  const add = (modelId: string, problem: string) => problems.push({ provider: "fal", modelId, problem });
  for (const model of models) {
    const entry = found.find((f) => f.endpoint_id === model.id);
    if (!entry) {
      add(model.id, "Not in Fal's catalog any more.");
      continue;
    }
    if (entry.metadata?.status && entry.metadata.status !== "active") add(model.id, `Fal lists it as "${entry.metadata.status}".`);
    const input = inputSchema(entry.openapi);
    if (!input) continue;
    const props = input.schema.properties ?? {};

    const imageField = model.falInput?.image;
    if (imageField && !props[imageField]) add(model.id, `No longer takes "${imageField}" for the image.`);

    const ratioField = model.falInput?.aspectRatio;
    if (model.aspectRatios && ratioField) {
      const accepted = enumOf(props[ratioField], input.resolve);
      if (!props[ratioField]) add(model.id, `No longer takes "${ratioField}".`);
      else if (accepted) {
        const wanted = ratioField === "image_size" ? model.aspectRatios.map((r) => FAL_NAMED_IMAGE_SIZES[r] ?? r) : model.aspectRatios;
        const missing = wanted.filter((v) => !accepted.includes(v));
        if (missing.length > 0) add(model.id, `No longer takes these ${ratioField} values: ${missing.join(", ")}.`);
      }
    }

    const sent = new Set(["prompt", imageField ?? "", ratioField ?? ""]);
    for (const name of input.schema.required ?? []) {
      if (!sent.has(name) && props[name]?.default === undefined) add(model.id, `Now requires "${name}", which Chai doesn't send.`);
    }
  }
  return problems;
}

async function checkOpenRouter(
  models: { kind: MediaKind; model: ModelOption }[],
  fetchImpl: typeof fetch
): Promise<SuggestedModelProblem[]> {
  let catalog: { id: string; architecture?: { input_modalities?: string[] } }[];
  try {
    const res = await fetchImpl("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    catalog = ((await res.json()) as { data?: typeof catalog }).data ?? [];
  } catch (err) {
    return [{ provider: "openrouter", modelId: "*", problem: `Couldn't reach OpenRouter's model list: ${(err as Error).message}` }];
  }
  const problems: SuggestedModelProblem[] = [];
  for (const { kind, model } of models) {
    const entry = catalog.find((c) => c.id === model.id);
    if (!entry) problems.push({ provider: "openrouter", modelId: model.id, problem: "Not in OpenRouter's catalog any more." });
    else if (!entry.architecture?.input_modalities?.includes(kind))
      problems.push({ provider: "openrouter", modelId: model.id, problem: `No longer accepts ${kind}.` });
  }
  return problems;
}

type OpenApi = {
  paths?: Record<string, { post?: { requestBody?: { content?: Record<string, { schema?: Schema }> } } }>;
  components?: { schemas?: Record<string, Schema> };
};

/** The model's request schema, from its OpenAPI document, with a resolver for `$ref`s. */
function inputSchema(openapi: OpenApi | undefined): { schema: Schema; resolve: (s: Schema) => Schema } | null {
  const schemas = openapi?.components?.schemas ?? {};
  const resolve = (s: Schema): Schema => (s.$ref ? (schemas[s.$ref.split("/").pop()!] ?? s) : s);
  for (const path of Object.values(openapi?.paths ?? {})) {
    const body = path.post?.requestBody?.content?.["application/json"]?.schema;
    if (body) return { schema: resolve(body), resolve };
  }
  return null;
}

/** The allowed values of a field, wherever its schema keeps them. */
function enumOf(field: Schema | undefined, resolve: (s: Schema) => Schema): unknown[] | null {
  if (!field) return null;
  for (const s of [field, ...(field.anyOf ?? []), ...(field.allOf ?? [])].map(resolve)) {
    if (s.enum) return s.enum;
    if (s.const !== undefined) return [s.const];
  }
  return null;
}
