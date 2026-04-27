<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AISettingsDialog from '@/components/AISettingsDialog.vue'
import WorkspaceBar from '@/components/WorkspaceBar.vue'
import { useProjects, type PipelineStep } from '@/composables/use-projects'

const route = useRoute()
const { context, PIPELINE_STEPS, markStepVisited } = useProjects()

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
      <RouterView />
    </div>
    <AISettingsDialog />
  </div>
</template>
