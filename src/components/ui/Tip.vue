<script setup lang="ts">
import { computed } from 'vue'
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

import { useTooltipUI } from '@/components/ui/tooltip'

const cls = useTooltipUI({ content: 'animate-in zoom-in-95 fade-in' })

const { label, side: sideProp } = defineProps<{
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}>()

const side = computed(() => sideProp ?? 'top')
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent :side="side" :side-offset="4" :class="cls.content">
        {{ label }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
