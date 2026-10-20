<script setup lang="ts">
/** The "+" / "×" attach control: a positioned popover of the use-case actions, and the hidden file picker behind "Add media". */
import { nextTick, ref, watch, type Component } from "vue";
import { menuOpensAbove, type ComposerAttachMenuAction, type composerAttachMenuItems, type MenuPlacement } from "@chai-ui/core";
import { useDismiss } from "../dismiss.js";
import { AttachFileIcon, CloseSymbolIcon, ContentCutIcon, ImageIcon, MusicNoteIcon, PlusIcon, GlobeIcon, VideocamIcon, VolumeUpIcon } from "../icons.js";

const props = defineProps<{
  items: ReturnType<typeof composerAttachMenuItems>;
  /** Edit mode: one image file at a time. */
  imagesOnly?: boolean;
  disabled?: boolean;
  placement: MenuPlacement;
}>();
const emit = defineEmits<{ select: [action: ComposerAttachMenuAction]; files: [files: FileList | null] }>();

const ICONS: Record<ComposerAttachMenuAction, Component> = {
  "add-media": AttachFileIcon,
  "create-image": ImageIcon,
  "create-video": VideocamIcon,
  "create-world": GlobeIcon,
  "edit-image": ContentCutIcon,
  "create-speech": VolumeUpIcon,
  "create-music": MusicNoteIcon,
};
const open = ref(false);
const above = ref(false);
const root = ref<HTMLElement>();
const menu = ref<HTMLElement>();
const input = ref<HTMLInputElement>();
useDismiss(root, open, () => (open.value = false));

// Up or down, before the first paint, so it never flashes on the wrong side.
watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  above.value = menuOpensAbove(props.placement, root.value!.getBoundingClientRect(), menu.value!.offsetHeight, document.documentElement.clientHeight);
});

function pick(action: ComposerAttachMenuAction) {
  open.value = false;
  if (action === "add-media") input.value?.click();
  emit("select", action);
}

function onFileChange(e: Event) {
  const el = e.target as HTMLInputElement;
  emit("files", el.files);
  el.value = "";
}
</script>

<template>
  <div ref="root" class="chai-composer__attach">
    <button
      type="button"
      :class="['chai-composer__attach-toggle', { 'chai-composer__attach-toggle--open': open }]"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="open ? 'Close attach menu' : 'Add media'"
      @click="open = !open"
    >
      <CloseSymbolIcon v-if="open" /><PlusIcon v-else />
    </button>
    <ul v-if="open" ref="menu" :class="['chai-composer__attach-menu', { 'chai-composer__attach-menu--above': above }]" role="menu">
      <li v-for="(item, i) in items" :key="item.action" role="none">
        <button type="button" role="menuitem" class="chai-composer__attach-menu-item" @click="pick(item.action)">
          <span class="chai-composer__attach-menu-icon"><component :is="ICONS[item.action]" /></span>{{ item.label }}
        </button>
        <hr v-if="item.divider && i < items.length - 1" class="chai-composer__attach-menu-divider" role="separator" />
      </li>
    </ul>
    <input
      ref="input"
      type="file"
      :accept="imagesOnly ? 'image/*' : 'image/*,video/*,audio/*'"
      :multiple="!imagesOnly"
      hidden
      :disabled="disabled"
      @change="onFileChange"
    />
  </div>
</template>
