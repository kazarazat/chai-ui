<script lang="ts">
  // The README's `<EditCard {...composer.edit} />` and the other components,
  // type-checked and server-rendered against the installed package.
  import { Composer, EditCard, MediaAnalyzer, SidePanel, useComposer, useMediaAnalyzer, type MediaAnalysisPromptLength } from "@chai-ui/svelte";
  import type { ComposerAttachment, MediaAnalyzerAttachment } from "@chai-ui/svelte";

  let value = $state("");
  let attachments = $state<ComposerAttachment[]>([]);
  const editImage = $derived(attachments[0]);
  const composer = useComposer(() => ({ editImage }));

  const analyzer = useMediaAnalyzer();
  let media = $state<MediaAnalyzerAttachment[]>([]);
  let modelId = $state<string | null>(null);
  let autoSelectModel = $state(false);
  let promptLength = $state<MediaAnalysisPromptLength | null>(null);
</script>

<Composer
  {value}
  onChange={(next) => (value = next)}
  {attachments}
  onAttachmentsChange={(next) => (attachments = next)}
  regions={composer.edit?.regions}
  onSubmit={composer.submit}
/>
{#if composer.edit}<EditCard {...composer.edit} />{/if}

<MediaAnalyzer
  attachments={media}
  onAttachmentsChange={(next) => (media = next)}
  {modelId}
  onModelChange={(id) => (modelId = id)}
  {autoSelectModel}
  onAutoSelectModelChange={(on) => (autoSelectModel = on)}
  {promptLength}
  onPromptLengthChange={(length) => (promptLength = length)}
  promptLengthOptions={[{ value: "concise", label: "Concise" }]}
  submitting={analyzer.analyzing}
  onSubmit={analyzer.submit}
  onAbort={analyzer.cancel}
/>

<SidePanel title="Assistant" mode="overlay" pageContext promptTips={["Summarize this page", "Draft a reply"]} />
