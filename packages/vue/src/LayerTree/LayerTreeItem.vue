<script setup lang="ts">
import { computed, ref } from 'vue'

import { useLayerTree } from './context'

import type { LayerNode } from './context'

const props = defineProps<{
  node: LayerNode
  level: number
  hasChildren: boolean
}>()

const emit = defineEmits<{
  select: [id: string, additive: boolean]
  toggleExpand: [id: string]
  toggleVisibility: [id: string]
  toggleLock: [id: string]
  rename: [id: string, name: string]
}>()

const ctx = useLayerTree()

const isSelected = computed(() => props.node ? ctx.selectedIds.value.has(props.node.id) : false)
const isDragging = computed(() => false)
const padLeft = computed(() => `${8 + (props.level - 1) * ctx.indentPerLevel}px`)

const rowEl = ref<HTMLElement | null>(null)

function onRef(el: unknown) {
  const htmlEl = el as HTMLElement | null
  rowEl.value = htmlEl
  if (props.node) ctx.setRowRef(props.node.id, htmlEl)
}

defineExpose({ rowEl })
</script>

<template>
  <div v-if="props.node" :ref="onRef" :data-node-id="props.node.id">
    <slot
      :node="props.node"
      :level="props.level"
      :has-children="props.hasChildren"
      :is-selected="isSelected"
      :is-dragging="isDragging"
      :pad-left="padLeft"
      :select="
        (additive: boolean) => {
          if (!props.node) return
          emit('select', props.node.id, additive)
          ctx.select(props.node.id, additive)
        }
      "
      :toggle-expand="
        () => {
          if (!props.node) return
          emit('toggleExpand', props.node.id)
          ctx.toggleExpand(props.node.id)
        }
      "
      :toggle-visibility="
        () => {
          if (!props.node) return
          emit('toggleVisibility', props.node.id)
          ctx.toggleVisibility(props.node.id)
        }
      "
      :toggle-lock="
        () => {
          if (!props.node) return
          emit('toggleLock', props.node.id)
          ctx.toggleLock(props.node.id)
        }
      "
      :rename="
        (name: string) => {
          if (!props.node) return
          emit('rename', props.node.id, name)
          ctx.rename(props.node.id, name)
        }
      "
    />
  </div>
</template>
