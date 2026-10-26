<script lang="ts">
  /** The "+" / "×" attach control: a positioned popover of the use-case actions, and the hidden file picker behind "Add media". */
  import { tick } from "svelte";
  import { menuOpensAbove, type ComposerAttachMenuAction, type composerAttachMenuItems, type MenuPlacement } from "@chai-ui/core";
  import { useDismiss } from "../dismiss.svelte.js";
  import Icon from "../Icon.svelte";
  import {
    AttachFileIcon,
    CloseSymbolIcon,
    ContentCutIcon,
    GlobeIcon,
    ImageIcon,
    MusicNoteIcon,
    PlusIcon,
    VideocamIcon,
    VolumeUpIcon,
    type IconData,
  } from "../icons.js";

  let {
    items,
    imagesOnly = false,
    disabled = false,
    placement,
    onSelect,
    onFiles,
  }: {
    items: ReturnType<typeof composerAttachMenuItems>;
    /** Edit mode: one image file at a time. */
    imagesOnly?: boolean;
    disabled?: boolean;
    placement: MenuPlacement;
    onSelect: (action: ComposerAttachMenuAction) => void;
    onFiles: (files: FileList | null) => void;
  } = $props();

  const ICONS: Record<ComposerAttachMenuAction, IconData> = {
    "add-media": AttachFileIcon,
    "create-image": ImageIcon,
    "create-video": VideocamIcon,
    "create-world": GlobeIcon,
    "edit-image": ContentCutIcon,
    "create-speech": VolumeUpIcon,
    "create-music": MusicNoteIcon,
  };
  let open = $state(false);
  let above = $state(false);
  let root = $state<HTMLElement>();
  let menu = $state<HTMLElement>();
  let input = $state<HTMLInputElement>();
  useDismiss(
    () => root,
    () => open,
    () => (open = false)
  );

  // Up or down, before the first paint, so it never flashes on the wrong side.
  async function toggle() {
    open = !open;
    if (!open) return;
    await tick();
    above = menuOpensAbove(placement, root!.getBoundingClientRect(), menu!.offsetHeight, document.documentElement.clientHeight);
  }

  function pick(action: ComposerAttachMenuAction) {
    open = false;
    if (action === "add-media") input?.click();
    onSelect(action);
  }

  function onchange(e: Event) {
    const el = e.target as HTMLInputElement;
    onFiles(el.files);
    el.value = "";
  }
</script>

<div bind:this={root} class="chai-composer__attach">
  <button
    type="button"
    class={["chai-composer__attach-toggle", { "chai-composer__attach-toggle--open": open }]}
    {disabled}
    aria-expanded={open}
    aria-haspopup="menu"
    aria-label={open ? "Close attach menu" : "Add media"}
    onclick={toggle}
  >
    <Icon icon={open ? CloseSymbolIcon : PlusIcon} />
  </button>
  {#if open}
    <ul bind:this={menu} class={["chai-composer__attach-menu", { "chai-composer__attach-menu--above": above }]} role="menu">
      {#each items as item, i (item.action)}
        <li role="none">
          <button type="button" role="menuitem" class="chai-composer__attach-menu-item" onclick={() => pick(item.action)}>
            <span class="chai-composer__attach-menu-icon"><Icon icon={ICONS[item.action]} /></span>{item.label}
          </button>
          {#if item.divider && i < items.length - 1}<hr class="chai-composer__attach-menu-divider" />{/if}
        </li>
      {/each}
    </ul>
  {/if}
  <input
    bind:this={input}
    type="file"
    accept={imagesOnly ? "image/*" : "image/*,video/*,audio/*"}
    multiple={!imagesOnly}
    hidden
    {disabled}
    {onchange}
  />
</div>
