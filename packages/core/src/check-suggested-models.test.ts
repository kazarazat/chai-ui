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
});
