<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@norka/vue'

import { useCodeConnectStore } from '@/stores/code-connect'

const { componentNodeId } = defineProps<{
  componentNodeId: string
}>()

const emit = defineEmits<{
  openCodeConnect: []
}>()

const { dialogs } = useI18n()
const codeConnect = useCodeConnectStore()

const entry = computed(() => codeConnect.getEntry(componentNodeId))
const rules = computed(() => entry.value?.rules ?? null)
</script>

<template>
  <div v-if="entry" class="border-t border-border px-3 py-2">
    <div class="mb-1.5 flex items-center justify-between">
      <span class="text-[10px] font-medium uppercase tracking-wide text-muted">
        {{ entry.codeComponent || entry.designName }}
      </span>
      <button class="text-[10px] text-accent hover:underline" @click="emit('openCodeConnect')">
        {{ dialogs.codeConnect }}
      </button>
    </div>

    <!-- No rules badge -->
    <div
      v-if="!rules"
      class="flex cursor-pointer items-center gap-1.5 rounded border border-warning/30 bg-warning/10 px-2 py-1.5 text-[10px] text-warning"
      @click="emit('openCodeConnect')"
    >
      <icon-lucide-alert-triangle class="size-3 shrink-0" />
      {{ dialogs.noRules }}
    </div>

    <!-- Rules summary -->
    <div v-else class="flex flex-col gap-1">
      <p class="text-[11px] text-surface">{{ rules.usage }}</p>
      <ul v-if="rules.constraints.length > 0" class="flex flex-col gap-0.5">
        <li
          v-for="c in rules.constraints"
          :key="c"
          class="flex items-start gap-1 text-[10px] text-muted"
        >
          <span class="mt-0.5 shrink-0 text-warning">·</span>
          {{ c }}
        </li>
      </ul>
      <p class="mt-0.5 text-[9px] text-muted/60">
        {{ dialogs.rulesUpdatedBy }}: {{ rules.updatedBy }} ·
        {{ new Date(rules.updatedAt).toLocaleDateString() }}
      </p>
    </div>
  </div>
</template>
