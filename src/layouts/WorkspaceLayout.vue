<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import AISettingsDialog from '@/components/AISettingsDialog.vue'
import WorkspaceBar from '@/components/WorkspaceBar.vue'
import { usePrimeTheme } from '@/composables/use-prime-theme'
import { useProjects, type PipelineStep } from '@/composables/use-projects'
import { buildWorkspacePath, isPipelineStep } from '@/utils/workspace-route'

const route = useRoute()
const { theme, themes } = usePrimeTheme()
const {
  context,
  currentFeature,
  currentProduct,
  currentScreen,
  PIPELINE_STEPS,
  markStepVisited,
  setContext
} = useProjects()

const currentStep = computed(() => {
  const stepSegment = route.path.split('/').filter(Boolean).at(-1)
  if (!isPipelineStep(stepSegment)) return null
  return PIPELINE_STEPS.find((s) => s.key === stepSegment) ?? null
})

const isWorkspaceRoute = computed(() => route.path.startsWith('/workspace/'))
const routeContext = computed(() => {
  const productId = route.params.productId
  const screenId = route.params.screenId
  const featureId = route.params.featureId
  if (
    typeof productId !== 'string' ||
    typeof screenId !== 'string' ||
    typeof featureId !== 'string'
  ) {
    return null
  }
  return { productId, screenId, featureId }
})

function stepLink(step: PipelineStep): string {
  return routeContext.value ? buildWorkspacePath(step, routeContext.value) : '/projects'
}

watch(
  routeContext,
  (next) => {
    if (!next) return
    setContext(next.productId, next.screenId, next.featureId)
  },
  { immediate: true }
)

// Record step visits automatically when route changes
watch(
  () => route.path,
  () => {
    if (!currentStep.value || !context.value) return
    if (currentStep.value.key === 'handoff') return
    const { productId, screenId, featureId } = context.value
    markStepVisited(productId, screenId, featureId, currentStep.value.key as PipelineStep)
  },
  { immediate: true }
)
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <WorkspaceBar />
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header class="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-panel px-3">
        <RouterLink
          to="/projects"
          class="rounded px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-hover hover:text-surface"
        >
          Проекты
        </RouterLink>
        <icon-lucide-chevron-right class="size-3 text-muted/60" />

        <span class="max-w-[24ch] truncate rounded px-1.5 py-0.5 text-[11px] text-surface">
          {{ currentProduct?.title ?? 'Проект не выбран' }}
        </span>
        <icon-lucide-chevron-right class="size-3 text-muted/60" />

        <span class="max-w-[24ch] truncate rounded px-1.5 py-0.5 text-[11px] text-surface">
          {{ currentScreen?.title ?? 'Экран не выбран' }}
        </span>
        <icon-lucide-chevron-right class="size-3 text-muted/60" />

        <span class="max-w-[28ch] truncate rounded px-1.5 py-0.5 text-[11px] text-surface">
          {{ currentFeature?.title ?? 'Фича не выбрана' }}
        </span>

        <div class="ml-2 h-4 w-px bg-border" />

        <template v-for="step in PIPELINE_STEPS" :key="step.key">
          <span
            v-if="currentStep?.key === step.key"
            class="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent"
          >
            {{ step.label }}
          </span>
          <RouterLink
            v-else
            :to="stepLink(step.key)"
            class="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted transition-colors hover:bg-hover hover:text-surface"
          >
            {{ step.label }}
          </RouterLink>
        </template>

        <div class="flex-1" />

        <select
          v-if="currentStep?.key === 'design' || currentStep?.key === 'discussion' || currentStep?.key === 'handoff'"
          v-model="theme"
          class="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-muted outline-none focus:border-accent/60"
        >
          <option v-for="item in themes" :key="item.id" :value="item.id">
            {{ item.label }}
          </option>
        </select>

        <RouterLink
          v-if="!context && isWorkspaceRoute"
          to="/projects"
          class="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 transition-colors hover:bg-amber-500/20"
        >
          Выбрать проект и фичу
        </RouterLink>
      </header>
      <div class="min-h-0 flex-1">
        <RouterView />
      </div>
    </div>
    <AISettingsDialog />
  </div>
</template>
