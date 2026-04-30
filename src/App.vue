<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor } from '@norka/vue'
import AISettingsDialog from '@/components/AISettingsDialog.vue'
import AppToast from '@/components/AppToast.vue'
import WorkspaceBar from '@/components/WorkspaceBar.vue'
import { setActiveEditorStore, useEditorStore } from '@/stores/editor'
import { createTab, getActiveStore } from '@/stores/tabs'
import { useWorkspaceUser } from '@/composables/use-workspace-user'
import { toast } from '@/utils/toast'

useHead({ titleTemplate: (title) => (title ? `${title} — Norka` : 'Norka') })

try {
  setActiveEditorStore(getActiveStore())
} catch {
  const created = createTab()
  setActiveEditorStore(created.store)
}

const store = useEditorStore()
provideEditor(store)
const route = useRoute()
const { isAuthenticated } = useWorkspaceUser()
const showAppShell = computed(() => isAuthenticated.value && route.path !== '/login')

onMounted(() => {
  toast.setupGlobalErrorHandler()
  // Remove splash loader — works for all routes, not just WorkspaceLayout
  const loader = document.getElementById('loader')
  if (loader) {
    loader.classList.add('fade-out')
    setTimeout(() => loader.remove(), 300)
  }
})
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <div class="h-screen w-screen overflow-hidden bg-canvas">
      <div v-if="showAppShell" class="flex h-full w-full overflow-hidden">
        <WorkspaceBar />
        <div class="min-w-0 flex-1 overflow-hidden">
          <RouterView />
        </div>
      </div>
      <RouterView v-else />
    </div>
    <AISettingsDialog />
    <AppToast />
  </TooltipProvider>
</template>
