<script lang="ts">
  import { useReasoning } from "../../reasoning.js";

  const reasoning = useReasoning();
</script>

<p data-testid="model">{reasoning.current?.model ?? "none"}</p>
<p data-testid="video">{reasoning.current?.modelByKind.video ?? "none"}</p>
