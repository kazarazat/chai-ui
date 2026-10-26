// Every component renders on the server, as in SvelteKit, without touching
// browser-only APIs (no window, document or animation frames there).
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { EditVersion, MediaAnalyzerAttachment, Result } from "@chai-ui/core";
import Composer from "./Composer.svelte";
import EditCard from "./EditCard.svelte";
import MediaAnalyzer from "./MediaAnalyzer.svelte";
import ResultCard from "./ResultCard.svelte";
import Setup from "./__tests__/fixtures/Setup.svelte";
import { useComposer } from "./useComposer.svelte.js";
import { useMediaAnalyzer } from "./useMediaAnalyzer.svelte.js";

const noop = () => {};
const image = "https://x/a.png";

describe("server render", () => {
  it("renders the Composer with its menus, chips, Enhance and the mic", async () => {
    const { body } = await render(Composer, {
      props: {
        value: "a mug",
        onChange: noop,
        onSubmit: noop,
        onEnhance: noop,
        onAttachmentsChange: noop,
        attachments: [{ id: "a", kind: "image", src: image }],
        onModelChange: noop,
        onAspectRatioChange: noop,
        useCase: { kind: "image", label: "Create image" },
        onClearUseCase: noop,
        voiceInput: { transcribe: async () => "" },
      },
    });
    expect(body).toContain('class="chai-composer');
    expect(body).toContain("Optimize prompt");
    expect(body).toContain("Start voice input");
  });

  it("renders a world's two fields", async () => {
    const { body } = await render(Composer, {
      props: { value: "", onChange: noop, onSubmit: noop, useCase: { kind: "world", label: "World" }, models: [], character: "", onCharacterChange: noop },
    });
    expect(body).toContain("Environment");
    expect(body).toContain("Character");
  });

  it("renders the ResultCard, paged, with its details side", async () => {
    const results: Result[] = [
      { id: "r1", runId: "x", modelId: "m", status: "done", output: { src: image, kind: "image" } },
      { id: "r2", runId: "x", modelId: "m", status: "running" },
      { id: "r3", runId: "x", modelId: "m", status: "done", output: { src: "Hello", kind: "text" } },
    ];
    const { body } = await render(ResultCard, { props: { results, prompt: "a mug", onAction: noop, moreActions: [{ id: "flag", label: "Flag" }] } });
    expect(body).toContain('class="chai-result-card');
    expect(body).toContain('role="slider"');
  });

  it("renders the MediaAnalyzer with an attachment", async () => {
    const attachments: MediaAnalyzerAttachment[] = [{ id: "a", kind: "image", src: image }];
    const { body } = await render(MediaAnalyzer, {
      props: {
        attachments,
        onAttachmentsChange: noop,
        modelId: null,
        onModelChange: noop,
        autoSelectModel: false,
        onAutoSelectModelChange: noop,
        promptLength: null,
        onPromptLengthChange: noop,
        promptLengthOptions: [{ value: "concise", label: "Concise" }],
        onSubmit: noop,
      },
    });
    expect(body).toContain('class="chai-media-analyzer');
  });

  it("renders the EditCard with versions and regions", async () => {
    const versions: EditVersion[] = [
      { id: "v0", status: "done", src: image, regions: [] },
      { id: "v1", status: "running", from: image, regions: [] },
    ];
    const { body } = await render(EditCard, {
      props: {
        versions,
        activeVersion: 0,
        onActiveVersionChange: noop,
        regions: [{ id: "g", number: 1, box: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, prompt: "red" }],
        onRegionsChange: noop,
      },
    });
    expect(body).toContain('class="chai-edit-card');
  });

  it("runs the hooks inside a ChaiProvider", async () => {
    let result: unknown;
    await render(Setup, { props: { use: () => [useComposer(), useMediaAnalyzer()], done: (r: unknown) => (result = r), provider: {} } });
    const [composer, analyzer] = result as [ReturnType<typeof useComposer>, ReturnType<typeof useMediaAnalyzer>];
    expect(composer.run).toBeNull();
    expect(composer.enhance).toBeInstanceOf(Function);
    expect(analyzer.analyzing).toBe(false);
  });
});
