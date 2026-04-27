<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  insert: []
  dragStart: [event: DragEvent]
}>()

const attrs = useAttrs()

// Read props from attrs — works with both kebab-case (direct use) and camelCase (reka-ui as-child)
const archetypeName = computed(() => (attrs.archetypeName ?? attrs['archetype-name']) as string)
const isContainer = computed(() => {
  const v = attrs.isContainer ?? attrs['is-container']
  return v === true || v === '' || v === 'true'
})
const isDisabled = computed(() => {
  const v = attrs.isDisabled ?? attrs['is-disabled']
  return v === true || v === '' || v === 'true'
})

// Filter out our custom props from attrs so they don't land as HTML attributes
const htmlAttrs = computed(() => {
  const { archetypeName: _a, 'archetype-name': _b, modulePath: _c, 'module-path': _d,
    exportName: _e, 'export-name': _f, previewProps: _g, 'preview-props': _h,
    isContainer: _l, 'is-container': _m,
    isDisabled: _i, 'is-disabled': _j, onClick: _k, ...rest } = attrs
  return rest
})
</script>

<template>
  <button
    draggable="true"
    v-bind="htmlAttrs"
    class="group relative flex w-full flex-col items-center gap-1 rounded-xl border bg-panel px-2.5 pb-2.5 pt-2.5 text-center transition-all duration-150"
    :class="
      isDisabled
        ? 'cursor-default border-border/35 bg-panel/70 opacity-45'
        : 'cursor-pointer border-border/55 hover:-translate-y-px hover:border-accent/35 hover:bg-accent/5 hover:shadow-[0_2px_10px_rgba(0,0,0,0.16)]'
    "
    :disabled="isDisabled"
    @click="emit('insert')"
    @dragstart="emit('dragStart', $event)"
  >
    <span class="line-clamp-2 min-h-8 w-full text-[11px] font-medium leading-snug text-surface">
      {{ archetypeName }}
    </span>

    <span
      class="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] transition-colors"
      :class="
        isContainer
          ? 'border-accent/35 bg-accent/15 text-accent'
          : 'border-border/45 bg-canvas/75 text-muted group-hover:text-surface/90'
      "
    >
      {{ isContainer ? 'container' : 'leaf' }}
    </span>
  </button>
</template>
