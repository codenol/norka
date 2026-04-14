<script setup lang="ts">
import { onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor } from '@beresta/vue'
import AppToast from '@/components/AppToast.vue'
import { useEditorStore } from '@/stores/editor'
import { toast } from '@/utils/toast'

useHead({ titleTemplate: (title) => (title ? `${title} — Nork` : 'Nork') })

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
