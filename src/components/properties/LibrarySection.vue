<script setup lang="ts">
import { computed } from 'vue'

import Tip from '@/components/ui/Tip.vue'
import { useSectionUI } from '@/components/ui/section'
import { useI18n } from '@beresta/vue'
import { useLibraryStore } from '@/stores/library'

const emit = defineEmits<{ openPanel: []; openDialog: [] }>()

const libraryStore = useLibraryStore()
const libraryCount = computed(() => libraryStore.libraryCount.value)
const sectionCls = useSectionUI()
const { panels } = useI18n()
</script>

<template>
  <div :class="sectionCls.wrapper">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-medium text-surface">{{ panels.libraries }}</label>
      <div class="flex items-center gap-0.5">
        <Tip :label="panels.openLibraries">
          <button
            class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
            @click="emit('openPanel')"
          >
            <icon-lucide-layout-grid class="size-3.5" />
          </button>
        </Tip>
        <Tip :label="panels.manageLibraries">
          <button
            class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
            @click="emit('openDialog')"
          >
            <icon-lucide-settings-2 class="size-3.5" />
          </button>
        </Tip>
      </div>
    </div>
    <div v-if="libraryCount > 0" class="mt-1 text-[11px] text-muted">
      {{ libraryCount }}
    </div>
    <div v-else class="mt-1 text-[11px] text-muted">{{ panels.noLibraries }}</div>
  </div>
</template>
