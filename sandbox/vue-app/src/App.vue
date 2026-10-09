<script setup lang="ts">
// A packaging smoke test, not a demo: if this renders a working Composer
// whose submit produces a ResultCard, the installed tarballs work as a real
// Vue app would use them. Offline: with no engine, useComposer uses mockEngine.
import { ref } from "vue";
import { ChaiProvider, Composer, ResultCard, useComposer, type ComposerAttachment } from "@chai-ui/vue";

const value = ref("");
const attachments = ref<ComposerAttachment[]>([]);
const { run, submit } = useComposer();
</script>

<template>
  <!-- ChaiProvider here only proves it resolves: provide reaches children, so this component's own useComposer doesn't see it. -->
  <ChaiProvider>
    <main style="max-width: 720px; margin: 40px auto; font-family: system-ui">
      <h1 style="font-size: 1.1rem">CHAI UI Vue packaging smoke test</h1>
      <Composer
        v-model="value"
        v-model:attachments="attachments"
        :use-case="{ kind: 'image', label: 'Image' }"
        :models="[{ id: 'mock-model', label: 'Mock model', provider: 'mock', speed: 'fast' }]"
        model-id="mock-model"
        @submit="submit"
      />
      <ResultCard v-if="run" :results="run.results" :prompt="run.request.prompt" @action="() => {}" />
    </main>
  </ChaiProvider>
</template>
