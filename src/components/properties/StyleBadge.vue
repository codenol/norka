<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, useSceneComputed, useSelectionState } from '@norka/vue'
import { useEditorStore } from '@/stores/editor'
import Tip from '@/components/ui/Tip.vue'

import type { StyleType } from '@norka/core'

const { styleType } = defineProps<{ styleType: StyleType }>()
const emit = defineEmits<{ openStyles: [] }>()

const editor = useEditorStore()
const { selectedNode } = useSelectionState()
const { dialogs } = useI18n()

const styleId = computed(() => {
  const node = selectedNode.value
  if (!node) return null
  if (styleType === 'FILL') return node.fillStyleId ?? null
  if (styleType === 'TEXT') return node.textStyleId ?? null
  if (styleType === 'EFFECT') return node.effectStyleId ?? null
  return null
})

const style = useSceneComputed(() => {
  void editor.state.sceneVersion
  const id = styleId.value
  if (!id) return null
  return editor.graph.styles.get(id) ?? null
})
</script>

<template>
  <div
    v-if="style"
    class="flex items-center gap-1.5 px-3 py-1"
  >
    <icon-lucide-bookmark class="size-3 shrink-0 text-accent" />
    <button
      class="flex-1 cursor-pointer truncate border-none bg-transparent text-left text-[11px] text-accent hover:underline"
      @click="emit('openStyles')"
    >
      {{ style.name }}
    </button>
    <Tip :label="dialogs.detachStyle">
      <button
        class="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
        @click="styleType === 'FILL' ? editor.graph.detachFillStyle(selectedNode!.id) : styleType === 'TEXT' ? editor.graph.detachTextStyle(selectedNode!.id) : editor.graph.detachEffectStyle(selectedNode!.id)"
      >
        <icon-lucide-unlink class="size-3" />
      </button>
    </Tip>
  </div>
</template>
