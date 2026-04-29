<script setup lang="ts">
import { ref, watch } from 'vue'

import { usePreview } from '@/composables/use-preview'
import { useI18n } from '@norka/vue'

const { isOpen, isGenerating, htmlCode, error, close, generate, reset } = usePreview()
const { dialogs } = useI18n()

const WIDTHS = [
  { label: '375', value: 375 },
  { label: '768', value: 768 },
  { label: '1280', value: 1280 },
  { label: '↔', value: 0 }
]
const iframeWidth = ref(0) // 0 = full

// Auto-generate when opened
watch(isOpen, (open) => {
  if (open && !htmlCode.value && !isGenerating.value) {
    generate()
  }
})
</script>

<template>
  <Transition name="preview-slide">
    <div
      v-if="isOpen"
      data-test-id="preview-panel"
      class="flex h-[40%] min-h-[200px] shrink-0 flex-col border-t border-border bg-panel"
    >
      <!-- Header -->
      <div class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <icon-lucide-monitor class="size-3.5 text-muted" />
        <span class="flex-1 text-[11px] font-medium text-surface">{{ dialogs.preview }}</span>

        <!-- Refresh -->
        <button
          class="rounded p-1 text-muted hover:bg-hover hover:text-surface"
          title="Обновить"
          :disabled="isGenerating"
          @click="reset(); generate()"
        >
          <icon-lucide-refresh-cw class="size-3.5" :class="isGenerating ? 'animate-spin' : ''" />
        </button>

        <!-- Width presets -->
        <div class="flex gap-0.5">
          <button
            v-for="w in WIDTHS"
            :key="w.value"
            class="rounded px-1.5 py-0.5 text-[10px]"
            :class="
              iframeWidth === w.value
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:bg-hover hover:text-surface'
            "
            @click="iframeWidth = w.value"
          >
            {{ w.label }}
          </button>
        </div>

        <!-- Close -->
        <button class="rounded p-1 text-muted hover:bg-hover hover:text-surface" @click="close">
          <icon-lucide-x class="size-3.5" />
        </button>
      </div>

      <!-- Body -->
      <div class="relative flex flex-1 overflow-auto bg-[#1a1a1a]">
        <!-- Generating state -->
        <div
          v-if="isGenerating"
          class="flex flex-1 flex-col items-center justify-center gap-2 text-muted"
        >
          <icon-lucide-loader-2 class="size-5 animate-spin" />
          <p class="text-xs">{{ dialogs.generating }}</p>
        </div>

        <!-- Error state -->
        <div
          v-else-if="error"
          class="flex flex-1 flex-col items-center justify-center gap-2 text-muted"
        >
          <icon-lucide-alert-circle class="size-5 text-red-400" />
          <p class="max-w-xs text-center text-xs text-red-400">{{ error }}</p>
        </div>

        <!-- iframe -->
        <div v-else-if="htmlCode" class="flex flex-1 items-start justify-center overflow-auto p-4">
          <iframe
            :srcdoc="htmlCode"
            :style="iframeWidth ? `width: ${iframeWidth}px; flex-shrink: 0;` : 'width: 100%;'"
            class="h-full border-0 bg-white"
            sandbox="allow-scripts"
            data-test-id="preview-iframe"
          />
        </div>

        <!-- Placeholder when not yet generated -->
        <div v-else class="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
          <icon-lucide-monitor class="size-8 opacity-30" />
          <p class="text-xs">{{ dialogs.preview }}</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.preview-slide-enter-active,
.preview-slide-leave-active {
  transition: height 0.2s ease;
  overflow: hidden;
}
.preview-slide-enter-from,
.preview-slide-leave-to {
  height: 0 !important;
}
</style>
