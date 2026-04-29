<script setup lang="ts">
import { setActiveEditorStore } from '@/stores/editor'
import { createTab, getActiveStore } from '@/stores/tabs'
import ReactPreviewView from '@/views/workspaces/ReactPreviewView.vue'

function ensureActiveEditorStore() {
  try {
    const active = getActiveStore()
    setActiveEditorStore(active)
  } catch {
    const created = createTab()
    setActiveEditorStore(created.store)
  }
}

ensureActiveEditorStore()
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-canvas">
    <ReactPreviewView />
  </div>
</template>
