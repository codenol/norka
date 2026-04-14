<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AISettingsDialog from '@/components/AISettingsDialog.vue'
import WorkspaceBar from '@/components/WorkspaceBar.vue'
import { useProjects, type PipelineStep } from '@/composables/use-projects'

const route = useRoute()
const { currentProduct, currentScreen, currentFeature, context, PIPELINE_STEPS, markStepVisited } = useProjects()

const currentStep = computed(() => {
  const segment = route.path.split('/workspace/')[1]?.split('/')[0]
  if (!segment) return null
  return PIPELINE_STEPS.find(s => s.key === segment) ?? null
})

// Record step visits automatically when route changes
watch(
  () => route.path,
  () => {
    if (!currentStep.value || !context.value) return
    const { productId, screenId, featureId } = context.value
    markStepVisited(productId, screenId, featureId, currentStep.value.key as PipelineStep)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <WorkspaceBar />
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">

      <!-- Breadcrumb strip -->
      <div class="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 bg-canvas px-3 text-[11px]">
        <!-- Проекты -->
        <button
          class="flex items-center gap-1 text-muted transition-colors hover:text-surface"
          @click="$router.push('/projects')"
        >
          <icon-lucide-layout-grid class="size-3" />
          <span>Проекты</span>
        </button>

        <!-- Product -->
        <icon-lucide-chevron-right class="size-3 text-muted/40" />
        <button
          v-if="currentProduct"
          class="text-muted transition-colors hover:text-surface"
          @click="$router.push('/projects')"
        >{{ currentProduct.title }}</button>
        <span v-else class="text-muted/40">Продукт</span>

        <!-- Screen -->
        <icon-lucide-chevron-right class="size-3 text-muted/40" />
        <button
          v-if="currentScreen"
          class="text-muted transition-colors hover:text-surface"
          @click="$router.push('/projects')"
        >{{ currentScreen.title }}</button>
        <span v-else class="text-muted/40">Экран</span>

        <!-- Feature -->
        <icon-lucide-chevron-right class="size-3 text-muted/40" />
        <button
          v-if="currentFeature"
          class="font-medium text-surface transition-colors hover:text-accent"
          @click="$router.push('/projects')"
        >{{ currentFeature.title }}</button>
        <span v-else class="text-muted/40">Фича</span>

        <!-- Current step (non-clickable) -->
        <template v-if="currentStep">
          <div class="mx-1.5 h-3 w-px bg-border" />
          <span class="text-accent">{{ currentStep.label }}</span>
        </template>
      </div>

      <RouterView />
    </div>
    <AISettingsDialog />
  </div>
</template>
