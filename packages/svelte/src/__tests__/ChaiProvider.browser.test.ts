import { expect, it } from "vitest";
import { DEFAULT_REASONING_MODEL, DEFAULT_REASONING_MODEL_BY_KIND } from "@chai-ui/core";
import ProviderHarness from "./fixtures/ProviderHarness.svelte";
import WithReasoning from "./fixtures/WithReasoning.svelte";
import { renderWith } from "./render.js";

type Props = { reasoningModel?: string; reasoningModelByKind?: { video?: string } };
const render = renderWith<Props>(ProviderHarness);

it("gives the components inside the suggested reasoning models", async () => {
  const screen = render({});
  await expect.element(screen.getByTestId("model")).toHaveTextContent(DEFAULT_REASONING_MODEL);
  await expect.element(screen.getByTestId("video")).toHaveTextContent(DEFAULT_REASONING_MODEL_BY_KIND.video!);
});

it("follows its props, and a dropped prop goes back to the default", async () => {
  const screen = render({ reasoningModel: "m-1", reasoningModelByKind: { video: "v-1" } });
  await expect.element(screen.getByTestId("model")).toHaveTextContent("m-1");
  await screen.rerender({ reasoningModel: "m-2" });
  await expect.element(screen.getByTestId("model")).toHaveTextContent("m-2");
  await expect.element(screen.getByTestId("video")).toHaveTextContent(DEFAULT_REASONING_MODEL_BY_KIND.video!);
});

it("leaves components outside a provider without reasoning", async () => {
  const screen = renderWith(WithReasoning)({});
  await expect.element(screen.getByTestId("model")).toHaveTextContent("none");
});
