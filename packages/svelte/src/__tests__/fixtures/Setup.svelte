<script lang="ts">
  import type { ComponentProps } from "svelte";
  import ChaiProvider from "../../ChaiProvider.svelte";
  import Use from "./Use.svelte";

  /** Runs `use` while a component initializes, inside a `ChaiProvider` when `provider` is set. */
  let {
    use,
    done,
    provider,
  }: { use: () => unknown; done: (result: unknown) => void; provider?: Omit<ComponentProps<typeof ChaiProvider>, "children"> } =
    $props();
</script>

{#if provider}
  <ChaiProvider {...provider}><Use {use} {done} /></ChaiProvider>
{:else}
  <Use {use} {done} />
{/if}
