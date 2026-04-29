<script setup lang="ts">
import { computed, ref } from 'vue'

import type { GradientStop } from '@norka/core'

const props = defineProps<{
  stops: GradientStop[]
  activeStopIndex: number
  barBackground: string
}>()

const emit = defineEmits<{
  selectStop: [index: number]
  dragStop: [index: number, position: number]
}>()

const barRef = ref<HTMLElement | null>(null)
const draggingIndex = ref<number | null>(null)

function onStopPointerDown(index: number, e: PointerEvent) {
  emit('selectStop', index)
  draggingIndex.value = index
  barRef.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  const el = barRef.value
  if (!el || draggingIndex.value === null || !el.hasPointerCapture(e.pointerId)) return
  const rect = el.getBoundingClientRect()
  const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  emit('dragStop', draggingIndex.value, pos)
}

function onPointerUp() {
  draggingIndex.value = null
}

function setBarRef(el: unknown) {
  barRef.value = el instanceof HTMLElement ? el : null
}

const slotProps = computed<Record<string, unknown>>(() => ({
  stops: props.stops,
  activeStopIndex: props.activeStopIndex,
  barBackground: props.barBackground,
  barRef: setBarRef,
  onStopPointerDown,
  onPointerMove,
  onPointerUp,
  draggingIndex: draggingIndex.value
}))

defineExpose({ barRef })
</script>

<template>
  <slot v-bind="slotProps" />
</template>
