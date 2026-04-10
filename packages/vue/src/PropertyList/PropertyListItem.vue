<script setup lang="ts">
import { usePropertyList } from './context'

const props = defineProps<{
  index: number
}>()

const emit = defineEmits<{
  update: [index: number, item: unknown]
  patch: [index: number, changes: Record<string, unknown>]
  remove: [index: number]
  toggleVisibility: [index: number]
}>()

const { update, patch, remove, toggleVisibility } = usePropertyList()
</script>

<template>
  <slot
    :index="props.index"
    :update="
      (item: unknown) => {
        emit('update', props.index, item)
        update(props.index, item)
      }
    "
    :patch="
      (changes: Record<string, unknown>) => {
        emit('patch', props.index, changes)
        patch(props.index, changes)
      }
    "
    :remove="
      () => {
        emit('remove', props.index)
        remove(props.index)
      }
    "
    :toggle-visibility="
      () => {
        emit('toggleVisibility', props.index)
        toggleVisibility(props.index)
      }
    "
  />
</template>
