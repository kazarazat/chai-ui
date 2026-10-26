<script lang="ts">
  import type { ComponentProps } from "svelte";
  import ChaiProvider from "../../ChaiProvider.svelte";
  import WithReasoning from "./WithReasoning.svelte";

  let props: Omit<ComponentProps<typeof ChaiProvider>, "children"> = $props();
</script>

<ChaiProvider {...props}><WithReasoning /></ChaiProvider>
