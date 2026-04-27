<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import { ref } from 'vue'

import { useEditor } from '@norka/vue/context/editorContext'
import { useCanvas, type UseCanvasOptions } from '@norka/vue'
import { provideCanvas } from './context'

const props = withDefaults(defineProps<UseCanvasOptions>(), {
  showRulers: undefined
})

const editor = useEditor()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)

const { renderNow, hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  editor,
  {
    ...props,
    onReady: () => {
      ready.value = true
    }
  }
)

provideCanvas({
  canvasRef,
  ready,
  renderNow,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle
})
</script>

<template>
  <slot :canvas-ref="canvasRef" :ready="ready" :render-now="renderNow" />
</template>
