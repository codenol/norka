<script setup lang="ts">
import { computed } from 'vue'
import { colorToHexRaw, parseColor } from '@open-pencil/core'

import type { Color } from '@open-pencil/core'
import type { OkHCLControls } from './types'

const props = defineProps<{
  color: Color
  editable?: boolean
  okhcl?: OkHCLControls | null
}>()

const emit = defineEmits<{ update: [color: Color] }>()

const hex = computed(() => props.color ? colorToHexRaw(props.color) : 'f5f5f5')

function updateFromHex(value: string) {
  const parsed = parseColor(value.startsWith('#') ? value : `#${value}`)
  emit('update', { ...parsed, a: props.color.a })
}
</script>

<template>
  <slot
    :color="props.color"
    :editable="props.editable ?? false"
    :hex="hex"
    :update-from-hex="updateFromHex"
    :update-color="(nextColor: Color) => emit('update', nextColor)"
    :okhcl="props.okhcl ?? null"
  />
</template>
