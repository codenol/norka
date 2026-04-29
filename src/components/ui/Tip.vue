<script setup lang="ts">
import { computed } from 'vue'
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

import { useTooltipUI } from '@/components/ui/tooltip'

const cls = useTooltipUI({ content: 'animate-in zoom-in-95 fade-in' })

const props = withDefaults(defineProps<{
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}>(), {
  side: 'top'
})

const side = computed(() => props.side)
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent :side="side" :side-offset="4" :class="cls.content">
        {{ props.label }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
