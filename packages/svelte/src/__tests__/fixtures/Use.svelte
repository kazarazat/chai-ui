<script lang="ts">
  let { use, done }: { use: () => unknown; done: (result: unknown) => void } = $props();
  // svelte-ignore state_referenced_locally
  done(use());
</script>
