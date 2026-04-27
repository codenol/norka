<script setup lang="ts">
import { computed } from 'vue'

import Tip from '@/components/ui/Tip.vue'
import { useSectionUI } from '@/components/ui/section'
import { useI18n, useSceneComputed } from '@norka/vue'
import { useEditorStore } from '@/stores/editor'

const emit = defineEmits<{ openDialog: [] }>()

const editor = useEditorStore()
const styleCount = useSceneComputed(() => {
  void editor.state.sceneVersion
  return editor.getStyleCount()
})
const hasStyles = computed(() => styleCount.value > 0)
const sectionCls = useSectionUI()
const { panels } = useI18n()
</script>

<template>
  <div :class="sectionCls.wrapper">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-medium text-surface">{{ panels.styles }}</label>
      <Tip :label="panels.openStyles">
        <button
          class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
          @click="emit('openDialog')"
        >
          <icon-lucide-settings-2 class="size-3.5" />
        </button>
      </Tip>
    </div>
    <div v-if="hasStyles" class="mt-1 text-[11px] text-muted">
      {{ styleCount }}
    </div>
    <div v-else class="mt-1 text-[11px] text-muted">{{ panels.noLocalStyles }}</div>
  </div>
</template>
