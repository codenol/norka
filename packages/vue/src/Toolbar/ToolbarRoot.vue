<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import { ref, computed } from 'vue'
import { EDITOR_TOOLS } from '@norka/core/editor'

import { useEditor } from '@norka/vue/context/editorContext'
import { provideToolbar } from './context'

import type { EditorToolDef, Tool } from '@norka/core/editor'

const props = defineProps<{
  tools?: EditorToolDef[]
}>()

const tools = computed(() => props.tools ?? EDITOR_TOOLS)

const editor = useEditor()
const activeTool = computed(() => editor.state.activeTool)
const expandedFlyout = ref<Tool | null>(null)

function setTool(tool: Tool) {
  editor.setTool(tool)
  expandedFlyout.value = null
}

function toggleFlyout(tool: Tool) {
  expandedFlyout.value = expandedFlyout.value === tool ? null : tool
}

function closeFlyout() {
  expandedFlyout.value = null
}

provideToolbar({
  editor,
  tools: tools.value,
  activeTool,
  expandedFlyout,
  setTool,
  toggleFlyout,
  closeFlyout
})
</script>

<template>
  <slot
    :tools="tools"
    :active-tool="activeTool"
    :expanded-flyout="expandedFlyout"
    :set-tool="setTool"
    :toggle-flyout="toggleFlyout"
    :close-flyout="closeFlyout"
  />
</template>
