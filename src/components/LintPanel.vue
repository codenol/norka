<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/stores/editor'
import { useLinterStore } from '@/stores/linter'
import Tip from './ui/Tip.vue'

import type { LintPreset } from '@/stores/linter'
import type { LintMessage } from '@open-pencil/core'

const editor = useEditorStore()
const linter = useLinterStore()
const { panels } = useI18n()

// ── Auto-run on scene changes ─────────────────────────────────────────────────

const stopWatch = watch(
  () => editor.state.sceneVersion,
  () => {
    linter.scheduledRun(editor.graph, editor.state.currentPageId)
  }
)

onUnmounted(() => {
  stopWatch()
  linter.cancelScheduled()
})

// ── Preset buttons ────────────────────────────────────────────────────────────

const PRESETS: Array<{ value: LintPreset; labelKey: 'lintPresetRecommended' | 'lintPresetStrict' | 'lintPresetAccessibility' }> = [
  { value: 'recommended', labelKey: 'lintPresetRecommended' },
  { value: 'strict', labelKey: 'lintPresetStrict' },
  { value: 'accessibility', labelKey: 'lintPresetAccessibility' },
]

function selectPreset(preset: LintPreset) {
  linter.setPreset(preset)
  runNow()
}

function runNow() {
  linter.run(editor.graph, editor.state.currentPageId)
}

function togglePageScope() {
  linter.setActivePageOnly(!linter.activePageOnly.value)
  runNow()
}

// ── Grouped issues ────────────────────────────────────────────────────────────

const errors = computed<LintMessage[]>(() =>
  (linter.results.value?.messages ?? []).filter((m) => m.severity === 'error')
)
const warnings = computed<LintMessage[]>(() =>
  (linter.results.value?.messages ?? []).filter((m) => m.severity === 'warning')
)
const infos = computed<LintMessage[]>(() =>
  (linter.results.value?.messages ?? []).filter((m) => m.severity === 'info')
)

const totalCount = computed(
  () => (linter.results.value?.errorCount ?? 0) + (linter.results.value?.warningCount ?? 0) + (linter.results.value?.infoCount ?? 0)
)

// ── Node selection ────────────────────────────────────────────────────────────

function selectNode(nodeId: string) {
  editor.state.selectedIds = new Set([nodeId])
  editor.flashNodes([nodeId])
}
</script>

<template>
  <div class="scrollbar-thin flex flex-1 flex-col overflow-x-hidden overflow-y-auto pb-4">
    <!-- Toolbar -->
    <div class="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      <!-- Preset selector -->
      <div class="flex gap-0.5">
        <button
          v-for="preset in PRESETS"
          :key="preset.value"
          class="rounded border px-1.5 py-0.5 text-[10px] cursor-pointer"
          :class="
            linter.preset.value === preset.value
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          @click="selectPreset(preset.value)"
        >
          {{ panels[preset.labelKey] }}
        </button>
      </div>

      <div class="flex-1" />

      <!-- Page scope toggle -->
      <Tip :label="linter.activePageOnly.value ? panels.lintAllPages : panels.lintCurrentPage">
        <button
          class="flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
          :class="
            linter.activePageOnly.value
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          @click="togglePageScope()"
        >
          <icon-lucide-file class="size-3" />
          {{ linter.activePageOnly.value ? panels.lintCurrentPage : panels.lintAllPages }}
        </button>
      </Tip>

      <!-- Run button -->
      <Tip :label="panels.lintRun">
        <button
          class="flex cursor-pointer items-center gap-1 rounded border border-border bg-transparent px-1.5 py-0.5 text-[10px] text-muted hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="linter.loading.value"
          @click="runNow()"
        >
          <icon-lucide-loader-2 v-if="linter.loading.value" class="size-3 animate-spin" />
          <icon-lucide-play v-else class="size-3" />
          {{ linter.loading.value ? panels.lintRunning : panels.lintRun }}
        </button>
      </Tip>
    </div>

    <!-- Not-run-yet state -->
    <div
      v-if="!linter.results.value && !linter.loading.value"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-center"
    >
      <icon-lucide-search class="size-8 text-muted" />
      <p class="text-xs text-muted">{{ panels.lintNotRun }}</p>
      <button
        class="mt-1 cursor-pointer rounded border border-border bg-transparent px-2.5 py-1 text-xs text-muted hover:bg-hover hover:text-surface"
        @click="runNow()"
      >
        {{ panels.lintRun }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-else-if="linter.loading.value" class="flex flex-1 items-center justify-center">
      <icon-lucide-loader-2 class="size-6 animate-spin text-muted" />
    </div>

    <!-- No issues state -->
    <div
      v-else-if="linter.results.value && totalCount === 0"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-center"
    >
      <icon-lucide-check-circle class="size-8 text-success" />
      <p class="text-xs text-muted">{{ panels.lintNoIssues }}</p>
    </div>

    <!-- Issue list -->
    <template v-else-if="linter.results.value">
      <!-- Summary bar -->
      <div class="flex shrink-0 items-center gap-3 border-b border-border/50 px-3 py-1.5 text-[10px]">
        <span v-if="errors.length > 0" class="flex items-center gap-1 text-error">
          <icon-lucide-circle-x class="size-3" />
          {{ errors.length }} {{ panels.lintErrors }}
        </span>
        <span v-if="warnings.length > 0" class="flex items-center gap-1 text-warning">
          <icon-lucide-triangle-alert class="size-3" />
          {{ warnings.length }} {{ panels.lintWarnings }}
        </span>
        <span v-if="infos.length > 0" class="flex items-center gap-1 text-muted">
          <icon-lucide-info class="size-3" />
          {{ infos.length }} {{ panels.lintInfos }}
        </span>
      </div>

      <!-- Errors -->
      <template v-if="errors.length > 0">
        <div class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border/50 bg-panel px-3 py-1">
          <icon-lucide-circle-x class="size-3 shrink-0 text-error" />
          <span class="text-[10px] font-semibold uppercase tracking-wider text-error">
            {{ panels.lintErrors }} ({{ errors.length }})
          </span>
        </div>
        <button
          v-for="msg in errors"
          :key="`${msg.ruleId}-${msg.nodeId}`"
          class="flex w-full cursor-pointer flex-col gap-0.5 border-b border-border/30 bg-transparent px-3 py-2 text-left hover:bg-hover/60"
          @click="selectNode(msg.nodeId)"
        >
          <span class="text-xs text-surface">{{ msg.message }}</span>
          <span class="truncate text-[10px] text-muted">{{ msg.nodeName }}</span>
          <span v-if="msg.suggest" class="mt-0.5 text-[10px] text-accent">
            ↳ {{ msg.suggest }}
          </span>
        </button>
      </template>

      <!-- Warnings -->
      <template v-if="warnings.length > 0">
        <div class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border/50 bg-panel px-3 py-1">
          <icon-lucide-triangle-alert class="size-3 shrink-0 text-warning" />
          <span class="text-[10px] font-semibold uppercase tracking-wider text-warning">
            {{ panels.lintWarnings }} ({{ warnings.length }})
          </span>
        </div>
        <button
          v-for="msg in warnings"
          :key="`${msg.ruleId}-${msg.nodeId}`"
          class="flex w-full cursor-pointer flex-col gap-0.5 border-b border-border/30 bg-transparent px-3 py-2 text-left hover:bg-hover/60"
          @click="selectNode(msg.nodeId)"
        >
          <span class="text-xs text-surface">{{ msg.message }}</span>
          <span class="truncate text-[10px] text-muted">{{ msg.nodeName }}</span>
          <span v-if="msg.suggest" class="mt-0.5 text-[10px] text-accent">
            ↳ {{ msg.suggest }}
          </span>
        </button>
      </template>

      <!-- Infos -->
      <template v-if="infos.length > 0">
        <div class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border/50 bg-panel px-3 py-1">
          <icon-lucide-info class="size-3 shrink-0 text-muted" />
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {{ panels.lintInfos }} ({{ infos.length }})
          </span>
        </div>
        <button
          v-for="msg in infos"
          :key="`${msg.ruleId}-${msg.nodeId}`"
          class="flex w-full cursor-pointer flex-col gap-0.5 border-b border-border/30 bg-transparent px-3 py-2 text-left hover:bg-hover/60"
          @click="selectNode(msg.nodeId)"
        >
          <span class="text-xs text-surface">{{ msg.message }}</span>
          <span class="truncate text-[10px] text-muted">{{ msg.nodeName }}</span>
          <span v-if="msg.suggest" class="mt-0.5 text-[10px] text-accent">
            ↳ {{ msg.suggest }}
          </span>
        </button>
      </template>
    </template>
  </div>
</template>
