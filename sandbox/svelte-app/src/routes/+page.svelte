<!-- Copied from packages/svelte/README.md (check-docs keeps them the same). -->
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { Composer, ResultCard, createFalEngine, useComposer } from "@chai-ui/svelte";

  const composer = useComposer({ engine: createFalEngine() });
  let value = $state("");
  const busy = $derived(composer.run?.results.some((r) => r.status === "queued" || r.status === "running") ?? false);

  async function enhance(prompt: string) {
    value = await composer.enhance!(prompt);
  }
</script>

<Composer
  {value}
  onChange={(next) => (value = next)}
  onSubmit={composer.submit}
  submitting={busy}
  onAbort={composer.cancel}
  onEnhance={composer.enhance && enhance}
  enhancing={composer.enhancing}
/>
{#if composer.run}
  <ResultCard results={composer.run.results} prompt={composer.run.request.prompt} onAction={() => {}} />
{/if}
