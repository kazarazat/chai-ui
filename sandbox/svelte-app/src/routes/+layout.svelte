<!-- Copied from packages/svelte/README.md (check-docs keeps them the same). -->
<!-- src/routes/+layout.svelte: tokens first, then the component styles that read them -->
<script lang="ts">
  import "@chai-ui/tokens/css";
  import "@chai-ui/svelte/style.css";
  import { ChaiProvider } from "@chai-ui/svelte";

  let { children } = $props();
</script>

<ChaiProvider>{@render children()}</ChaiProvider>
