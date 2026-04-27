<script setup lang="ts">
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { computed, onMounted, onUnmounted, ref, useAttrs } from 'vue'

import { loadPrimeModule, normalizePrimeProps } from '@/composables/use-primereact-preview'

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  insert: []
  dragStart: [event: DragEvent]
}>()

const attrs = useAttrs()

// Read props from attrs — works with both kebab-case (direct use) and camelCase (reka-ui as-child)
const archetypeName = computed(() => (attrs.archetypeName ?? attrs['archetype-name']) as string)
const modulePath = computed(() => (attrs.modulePath ?? attrs['module-path']) as string)
const exportName = computed(() => (attrs.exportName ?? attrs['export-name']) as string)
const previewProps = computed(() => (attrs.previewProps ?? attrs['preview-props'] ?? {}) as Record<string, unknown>)
const isContainer = computed(() => {
  const v = attrs.isContainer ?? attrs['is-container']
  return v === true || v === '' || v === 'true'
})
const isDisabled = computed(() => {
  const v = attrs.isDisabled ?? attrs['is-disabled']
  return v === true || v === '' || v === 'true'
})

const mountEl = ref<HTMLDivElement | null>(null)
const hasError = ref(false)
let reactRoot: Root | null = null

// Filter out our custom props from attrs so they don't land as HTML attributes
const htmlAttrs = computed(() => {
  const { archetypeName: _a, 'archetype-name': _b, modulePath: _c, 'module-path': _d,
    exportName: _e, 'export-name': _f, previewProps: _g, 'preview-props': _h,
    isContainer: _l, 'is-container': _m,
    isDisabled: _i, 'is-disabled': _j, onClick: _k, ...rest } = attrs
  return rest
})

onMounted(async () => {
  if (!mountEl.value) return
  try {
    const mod = await loadPrimeModule(modulePath.value)
    const Comp = mod?.[exportName.value]
    if (!Comp || !mountEl.value) return
    const props = normalizePrimeProps(archetypeName.value, previewProps.value)
    if (modulePath.value === 'primereact/dialog') {
      props.visible = false
      props.modal = false
      props.dismissableMask = false
      props.draggable = false
      props.onHide = () => undefined
    }
    reactRoot = createRoot(mountEl.value)
    reactRoot.render(createElement(Comp as never, props as never))
  } catch {
    hasError.value = true
  }
})

onUnmounted(() => {
  reactRoot?.unmount()
  reactRoot = null
})
</script>

<template>
  <button
    draggable="true"
    v-bind="htmlAttrs"
    class="group flex w-full flex-col items-center gap-1 rounded-lg border bg-panel px-1.5 pb-1.5 pt-1.5 text-center transition-colors"
    :class="
      isDisabled
        ? 'cursor-default border-border/30 opacity-40'
        : 'cursor-pointer border-border/60 hover:border-accent/50 hover:shadow-sm'
    "
    :disabled="isDisabled"
    @click="emit('insert')"
    @dragstart="emit('dragStart', $event)"
  >
    <!-- React preview area -->
    <div class="h-12 w-full overflow-hidden rounded bg-canvas">
      <div
        v-if="!hasError"
        ref="mountEl"
        class="pointer-events-none flex h-full w-full items-center justify-center"
      />
      <div v-else class="flex h-full items-center justify-center">
        <div class="flex size-7 items-center justify-center rounded bg-hover/60 text-muted">
          <icon-lucide-component class="size-4" />
        </div>
      </div>
    </div>
    <span class="line-clamp-1 w-full text-[10px] leading-tight text-surface">{{ archetypeName }}</span>
    <span
      class="rounded px-1 text-[9px]"
      :class="isContainer ? 'bg-accent/20 text-accent' : 'bg-hover text-muted'"
    >
      {{ isContainer ? 'container' : 'leaf' }}
    </span>
  </button>
</template>
