<script setup lang="ts">
// A packaging smoke test, not a demo: proves the installed tarballs resolve
// and type-check. Offline: with no engine, useComposer uses mockEngine.
// Grows into a Composer once it ships.
// (ChaiProvider here only proves it resolves: provide reaches children,
// so this component's own useComposer doesn't see it.)
import { ChaiProvider, ResultCard, useComposer } from "@chai-ui/vue";

const { run, submit } = useComposer();
const image = { kind: "image" as const, label: "Image" };
</script>

<template>
  <ChaiProvider>
    <button
      @click="
        submit({
          value: 'a red mug',
          attachments: [],
          aspectRatio: null,
          useCase: image,
          modelId: null,
          autoSelectModel: false,
          selections: [{ useCase: image, modelIds: [], models: [] }],
        })
      "
    >
      Generate
    </button>
    <ResultCard v-if="run" :results="run.results" :prompt="run.request.prompt" @action="() => {}" />
  </ChaiProvider>
</template>
