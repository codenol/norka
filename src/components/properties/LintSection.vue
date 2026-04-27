<script setup lang="ts">
import { computed } from 'vue'

import Tip from '@/components/ui/Tip.vue'
import { useSectionUI } from '@/components/ui/section'
import { useI18n } from '@norka/vue'
import { useLinterStore } from '@/stores/linter'

const emit = defineEmits<{ openPanel: [] }>()

const linter = useLinterStore()
const sectionCls = useSectionUI()
const { panels } = useI18n()

const errorCount = computed(() => linter.results.value?.errorCount ?? 0)
const warningCount = computed(() => linter.results.value?.warningCount ?? 0)
const hasRun = computed(() => linter.results.value !== null)
const hasIssues = computed(() => (linter.results.value?.messages.length ?? 0) > 0)
</script>

<template>
  <div :class="sectionCls.wrapper">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-medium text-surface">{{ panels.lint }}</label>
      <Tip :label="panels.lintOpenPanel">
        <button
          class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
          @click="emit('openPanel')"
        >
          <icon-lucide-shield-check class="size-3.5" />
        </button>
      </Tip>
    </div>

    <!-- Not run yet -->
    <div v-if="!hasRun" class="mt-1 text-[11px] text-muted">{{ panels.lintNotRun }}</div>

    <!-- No issues -->
    <div v-else-if="!hasIssues" class="mt-1 flex items-center gap-1 text-[11px] text-success">
      <icon-lucide-check class="size-3" />
      {{ panels.lintNoIssues }}
    </div>

    <!-- Issues summary -->
    <div v-else class="mt-1 flex items-center gap-2 text-[11px]">
      <span v-if="errorCount > 0" class="flex items-center gap-0.5 text-error">
        <icon-lucide-circle-x class="size-3" />
        {{ errorCount }}
      </span>
      <span v-if="warningCount > 0" class="flex items-center gap-0.5 text-warning">
        <icon-lucide-triangle-alert class="size-3" />
        {{ warningCount }}
      </span>
      <button
        class="cursor-pointer border-none bg-transparent p-0 text-[11px] text-muted underline-offset-2 hover:underline hover:text-surface"
        @click="emit('openPanel')"
      >
        {{ panels.lintOpenPanel }}
      </button>
    </div>
  </div>
</template>
