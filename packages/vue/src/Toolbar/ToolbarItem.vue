<script setup lang="ts">
import { computed } from 'vue'

import { useToolbar } from './context'

defineOptions({ inheritAttrs: false })

import type { Tool } from '@norka/core/editor'

const props = defineProps<{
  tool: Tool
}>()

const { activeTool, setTool } = useToolbar()

const isActive = computed(() => activeTool.value === props.tool)
</script>

<template>
  <slot :active="isActive" :select="() => setTool(props.tool)" :tool="props.tool" />
</template>
