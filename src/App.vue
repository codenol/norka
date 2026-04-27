<script setup lang="ts">
import { onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor } from '@norka/vue'
import AppToast from '@/components/AppToast.vue'
import { setActiveEditorStore, useEditorStore } from '@/stores/editor'
import { createTab, getActiveStore } from '@/stores/tabs'
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
    <div class="h-screen w-screen overflow-hidden">
      <RouterView />
    </div>
    <AppToast />
  </TooltipProvider>
</template>
