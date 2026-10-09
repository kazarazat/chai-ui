import { describe, expect, it } from "vitest";
import { checkSuggestedModels } from "./check-suggested-models.js";
import { SUGGESTED_ANALYSIS_MODELS, SUGGESTED_FAL_MODELS } from "./suggested-models.js";
import { FAL_NAMED_IMAGE_SIZES } from "./engines/fal.js";
import type { ModelOption } from "./types.js";

/** A Fal catalog entry that matches what Chai sends to `model`. */
function falEntry(model: ModelOption, tweak: (input: Record<string, unknown>) => void = () => {}) {
  const properties: Record<string, unknown> = { prompt: { type: "string" } };
  const field = model.falInput?.aspectRatio;
  if (field && model.aspectRatios) {
    properties[field] = { enum: field === "image_size" ? model.aspectRatios.map((r) => FAL_NAMED_IMAGE_SIZES[r]) : model.aspectRatios };
  }
  if (model.falInput?.image) properties[model.falInput.image] = { type: "string" };
  const input = { properties, required: ["prompt"] };
  tweak(input);
  return {
    endpoint_id: model.id,
    metadata: { status: "active" },
    openapi: {
      paths: { "/": { post: { requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Input" } } } } } } },
      components: { schemas: { Input: input } },
    },
  };
}

function fakeFetch(fal: unknown[], openrouter: unknown[]): typeof fetch {
  return (async (url: string) => {
    const body = String(url).includes("api.fal.ai") ? { models: fal, has_more: false } : { data: openrouter };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
}

const allFal = () => [...SUGGESTED_FAL_MODELS.values()].map((m) => falEntry(m));
const allOpenRouter = () =>
  Object.values(SUGGESTED_ANALYSIS_MODELS)
    .flat()
    .map((m) => ({ id: m!.id, architecture: { input_modalities: ["text", "image", "video", "audio"] } }));

describe("checkSuggestedModels", () => {
  it("passes when both catalogs match", async () => {
    const result = await checkSuggestedModels({ fetchImpl: fakeFetch(allFal(), allOpenRouter()) });
    expect(result).toMatchObject({ ok: true, problems: [] });
    expect(result.checked).toBeGreaterThan(20);
  });

  it("reports a model that's gone, inactive, or changed its inputs", async () => {
    const fal = allFal();
    const [gone, inactive, ratios, kling, required] = [
      "fal-ai/nano-banana-pro",
      "fal-ai/nano-banana-2",
      "minimax/h3-max/text-to-video",
      "fal-ai/kling-video/v3/pro/image-to-video",
      "fal-ai/veo3.1/fast",
    ];
    const at = (id: string) => fal.findIndex((f) => f.endpoint_id === id);
    fal.splice(at(gone), 1);
    fal[at(inactive)]!.metadata.status = "deprecated";
    fal[at(ratios)] = falEntry(SUGGESTED_FAL_MODELS.get(ratios)!, (input) => {
      (input.properties as Record<string, unknown>).aspect_ratio = { enum: ["16:9"] };
    });
    fal[at(kling)] = falEntry(SUGGESTED_FAL_MODELS.get(kling)!, (input) => {
      delete (input.properties as Record<string, unknown>).start_image_url;
    });
    fal[at(required)] = falEntry(SUGGESTED_FAL_MODELS.get(required)!, (input) => {
      (input.properties as Record<string, unknown>).duration = { type: "string" };
      input.required = ["prompt", "duration"];
    });

    const { ok, problems } = await checkSuggestedModels({ fetchImpl: fakeFetch(fal, allOpenRouter()) });
    expect(ok).toBe(false);
    const about = (id: string) => problems.filter((p) => p.modelId === id).map((p) => p.problem).join(" ");
    expect(about(gone)).toMatch(/Not in Fal's catalog/);
    expect(about(inactive)).toMatch(/deprecated/);
    expect(about(ratios)).toMatch(/21:9/);
    expect(about(kling)).toMatch(/start_image_url/);
    expect(about(required)).toMatch(/requires "duration"/);
  });

  it("reports an OpenRouter model that's gone or no longer takes its media kind", async () => {
    const openrouter = allOpenRouter().filter((m) => m.id !== "openai/gpt-5.2");
    openrouter.find((m) => m.id === "openai/gpt-audio")!.architecture.input_modalities = ["text"];
    const { problems } = await checkSuggestedModels({ fetchImpl: fakeFetch(allFal(), openrouter) });
    expect(problems).toContainEqual(expect.objectContaining({ modelId: "openai/gpt-5.2", provider: "openrouter" }));
    expect(problems).toContainEqual(expect.objectContaining({ modelId: "openai/gpt-audio", problem: "No longer accepts audio." }));
  });

  it("says so when a catalog can't be reached", async () => {
    const failing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const { problems } = await checkSuggestedModels({ fetchImpl: failing });
    expect(problems.map((p) => p.modelId)).toEqual(["*", "*"]);
  });

  it("says so when a catalog answers with an error status", async () => {
    const failing = (async () => new Response("", { status: 503, statusText: "Service Unavailable" })) as unknown as typeof fetch;
    const { problems } = await checkSuggestedModels({ fetchImpl: failing });
    expect(problems.map((p) => p.problem)).toEqual([
      "Couldn't reach Fal's model catalog: 503 Service Unavailable",
      "Couldn't reach OpenRouter's model list: 503 Service Unavailable",
    ]);
  });

  it("follows Fal's cursor through every page", async () => {
    const fal = allFal();
    const urls: string[] = [];
    const paged = (async (url: string) => {
      urls.push(String(url));
      if (!String(url).includes("api.fal.ai")) return new Response(JSON.stringify({ data: allOpenRouter() }));
      const second = String(url).includes("cursor=next");
      const body = second ? { models: fal.slice(10), has_more: false } : { models: fal.slice(0, 10), has_more: true, next_cursor: "next" };
      return new Response(JSON.stringify(body));
    }) as unknown as typeof fetch;
    const { ok } = await checkSuggestedModels({ fetchImpl: paged });
    expect(ok).toBe(true);
    expect(urls.filter((u) => u.includes("api.fal.ai"))).toHaveLength(2);
  });

  it("reads allowed values from anyOf, allOf and const, and skips what it can't check", async () => {
    const fal = allFal();
    const at = (id: string) => fal.findIndex((f) => f.endpoint_id === id);
    const set = (id: string, tweak: (props: Record<string, unknown>, input: Record<string, unknown>) => void) => {
      fal[at(id)] = falEntry(SUGGESTED_FAL_MODELS.get(id)!, (input) => tweak(input.properties as Record<string, unknown>, input));
    };
    const ratioModels = [...SUGGESTED_FAL_MODELS.values()].filter((m) => m.aspectRatios && m.falInput?.aspectRatio === "aspect_ratio");
    const [anyOf, allOf, constant, open, dropped] = ratioModels.map((m) => m.id);
    // Every listed ratio, but behind anyOf / a $ref'd allOf: still fine.
    set(anyOf!, (props) => (props.aspect_ratio = { anyOf: [{ type: "null" }, props.aspect_ratio] }));
    set(allOf!, (props) => (props.aspect_ratio = { allOf: [{ $ref: "#/components/schemas/Ratio" }] }));
    fal[at(allOf!)]!.openapi.components.schemas = {
      ...fal[at(allOf!)]!.openapi.components.schemas,
      Ratio: { enum: SUGGESTED_FAL_MODELS.get(allOf!)!.aspectRatios },
    } as never;
    // A single const value: the other ratios are reported.
    set(constant!, (props) => (props.aspect_ratio = { const: "16:9" }));
    // Free text: nothing to compare.
    set(open!, (props) => (props.aspect_ratio = { type: "string" }));
    // Gone entirely.
    set(dropped!, (props) => delete props.aspect_ratio);
    // A new required field with a default doesn't need sending; no schema at all is skipped.
    const [withDefault, noSchema] = [...SUGGESTED_FAL_MODELS.keys()].filter((id) => ![anyOf, allOf, constant, open, dropped].includes(id));
    set(withDefault!, (props, input) => {
      props.seed = { type: "integer", default: 0 };
      input.required = ["prompt", "seed"];
    });
    delete (fal[at(noSchema!)] as { openapi?: unknown }).openapi;

    const { problems } = await checkSuggestedModels({ fetchImpl: fakeFetch(fal, allOpenRouter()) });
    expect(problems.map((p) => p.modelId).sort()).toEqual([constant, dropped].sort());
    expect(problems.find((p) => p.modelId === dropped)?.problem).toBe('No longer takes "aspect_ratio".');
  });

  it("treats an empty answer as an empty catalog", async () => {
    const empty = (async () => new Response("{}")) as unknown as typeof fetch;
    const { problems } = await checkSuggestedModels({ fetchImpl: empty });
    expect(problems.every((p) => /catalog any more/.test(p.problem))).toBe(true);
  });
});

