<script setup lang="ts">
/** The "+" / "×" attach control: a positioned popover of the use-case actions, and the hidden file picker behind "Add media". */
import { ref } from "vue";
import type { ComposerAttachMenuAction, composerAttachMenuItems } from "@chai-ui/core";
import { useDismiss } from "../dismiss.js";
import { AttachFileIcon, CloseSymbolIcon, ContentCutIcon, ImageIcon, PlusIcon, VideocamIcon } from "../icons.js";

defineProps<{
  items: ReturnType<typeof composerAttachMenuItems>;
  /** Edit mode: one image file at a time. */
  imagesOnly?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ select: [action: ComposerAttachMenuAction]; files: [files: FileList | null] }>();

const ICONS = { "add-media": AttachFileIcon, "create-image": ImageIcon, "create-video": VideocamIcon, "edit-media": ContentCutIcon };
const open = ref(false);
const root = ref<HTMLElement>();
const input = ref<HTMLInputElement>();
useDismiss(root, open, () => (open.value = false));

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
    <ul v-if="open" class="chai-composer__attach-menu" role="menu">
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
