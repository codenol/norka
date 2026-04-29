<script setup lang="ts">
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ref, watch, onUnmounted, computed } from 'vue'

import {
  getPrimePreviewDef,
  loadPrimeModule,
  normalizePrimeProps
} from '@/composables/use-primereact-preview'
import { useProtoStore } from '@/composables/use-proto-store'
import type { ProtoNode } from '@/composables/use-proto-store'

const store = useProtoStore()

// Expose stable refs for template access
const nodes = store.nodes
const selectedId = store.selectedId
const mode = store.mode
const rootNodes = store.rootNodes

// WeakMap keyed on the DOM container element
const containerRootMap = new WeakMap<HTMLDivElement, Root>()
const idToContainer = new Map<string, HTMLDivElement>()
const moduleCache = new Map<string, Record<string, unknown> | null>()

// Drag-and-drop state
const dragOverNodeId = ref<string | null>(null)
const dragOverPosition = ref<'before' | 'inside' | 'after' | null>(null)
const dragInsideInsertIndex = ref<number | null>(null)

const isEditor = computed(() => mode.value === 'editor')

interface FlattenedNode {
  id: string
  depth: number
}

function nodeSection(node: ProtoNode | null | undefined): string {
  const value = node?.props?.__section
  return typeof value === 'string' ? value : ''
}

function flattenRoots(roots: ProtoNode[]): FlattenedNode[] {
  const out: FlattenedNode[] = []
  function visit(nodeId: string, depth: number) {
    out.push({ id: nodeId, depth })
    const children = store.getChildren(nodeId)
    for (const child of children) visit(child.id, depth + 1)
  }
  for (const root of roots) visit(root.id, 0)
  return out
}

const sidebarRoots = computed(() => rootNodes.value.filter((node) => nodeSection(node) === 'sidebar'))
const breadcrumbRoots = computed(() =>
  rootNodes.value.filter((node) => nodeSection(node) === 'breadcrumbs')
)
const mainRoots = computed(() =>
  rootNodes.value.filter((node) => {
    const section = nodeSection(node)
    return section !== 'sidebar' && section !== 'breadcrumbs'
  })
)

const sidebarNodes = computed<FlattenedNode[]>(() => flattenRoots(sidebarRoots.value))
const breadcrumbNodes = computed<FlattenedNode[]>(() => flattenRoots(breadcrumbRoots.value))
const mainNodes = computed<FlattenedNode[]>(() => flattenRoots(mainRoots.value))

function getOrCreateRoot(container: HTMLDivElement): Root {
  const existing = containerRootMap.get(container)
  if (existing) return existing
  const root = createRoot(container)
  containerRootMap.set(container, root)
  return root
}

async function renderNode(node: ProtoNode, container: HTMLDivElement) {
  const element = await createReactSubtree(node.id)
  idToContainer.set(node.id, container)
  const root = getOrCreateRoot(container)
  root.render((element ?? null) as never)
}

async function loadModuleCached(path: string): Promise<Record<string, unknown> | null> {
  if (moduleCache.has(path)) return moduleCache.get(path) ?? null
  const mod = await loadPrimeModule(path)
  moduleCache.set(path, mod)
  return mod
}

function shouldRenderMount(nodeId: string): boolean {
  const node = store.getNode(nodeId)
  if (!node) return false
  if (!node.parentId) return true
  return !store.canAcceptChildren(node.parentId)
}

async function createReactSubtree(nodeId: string): Promise<unknown | null> {
  const node = store.getNode(nodeId)
  if (!node) return null
  return createRuntimeSubtree(node)
}

async function createRuntimeSubtree(node: ProtoNode): Promise<unknown | null> {
  const mod = await loadModuleCached(node.importPath)
  if (!mod) return null
  const Comp = mod[node.exportName]
  if (!Comp) return null

  const props = normalizePrimeProps(node.componentName, node.props as Record<string, unknown>)
  if (node.componentName === 'Dialog') {
    props.onHide = () => {
      store.setProp(node.id, 'visible', false)
    }
  }
  const def = getPrimePreviewDef(node.componentName)
  const childNodes = store.getChildren(node.id)
  const childElements = (
    await Promise.all(childNodes.map((child) => createReactSubtree(child.id)))
  ).filter((v): v is unknown => v !== null)

  if (!def?.acceptsChildren || childElements.length === 0) {
    const element = createElement(Comp as never, props as never)
    return createElement(
      'div',
      { 'data-proto-node-id': node.id, style: { display: 'contents' } },
      element
    )
  }

  if (def.slots && def.slots.some((slot) => slot !== 'default')) {
    const bySlot = new Map<string, unknown[]>()
    for (let i = 0; i < childNodes.length; i++) {
      const slot = childNodes[i]?.slotName ?? 'default'
      const value = childElements[i]
      if (!value) continue
      const bucket = bySlot.get(slot) ?? []
      bucket.push(value)
      bySlot.set(slot, bucket)
    }
    for (const slotName of def.slots) {
      if (slotName === 'default') continue
      const slotElements = bySlot.get(slotName)
      if (!slotElements || slotElements.length === 0) continue
      props[slotName] = () =>
        createElement(
          'div',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
          ...(slotElements as never[])
        )
    }
    const defaultChildren = bySlot.get('default') ?? []
    const element = createElement(Comp as never, props as never, ...(defaultChildren as never[]))
    return createElement(
      'div',
      { 'data-proto-node-id': node.id, style: { display: 'contents' } },
      element
    )
  }

  const element = createElement(Comp as never, props as never, ...(childElements as never[]))
  return createElement(
    'div',
    { 'data-proto-node-id': node.id, style: { display: 'contents' } },
    element
  )
}

async function rerenderMountedNodes() {
  for (const [id, container] of idToContainer.entries()) {
    const node = store.getNode(id)
    if (!node || !shouldRenderMount(id)) {
      containerRootMap.get(container)?.unmount()
      containerRootMap.delete(container)
      idToContainer.delete(id)
      continue
    }
    await renderNode(node, container)
  }
}

// Re-render when node props change
watch(
  () =>
    nodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      slotName: n.slotName ?? null,
      order: n.order,
      componentName: n.componentName,
      props: { ...n.props }
    })),
  async (_, oldList) => {
    if (!oldList) return
    await rerenderMountedNodes()
  },
  { deep: true }
)

// Unmount removed nodes
watch(
  () => nodes.map((n) => n.id),
  (newIds) => {
    for (const [id, container] of idToContainer.entries()) {
      if (!newIds.includes(id)) {
        containerRootMap.get(container)?.unmount()
        containerRootMap.delete(container)
        idToContainer.delete(id)
      }
    }
  }
)

onUnmounted(() => {
  for (const container of idToContainer.values()) {
    containerRootMap.get(container)?.unmount()
    containerRootMap.delete(container)
  }
  idToContainer.clear()
})

function onNodeRef(node: ProtoNode, el: Element | null) {
  if (!shouldRenderMount(node.id)) return
  if (!el) return
  const container = el.querySelector<HTMLDivElement>('[data-react-mount]')
  if (!container) return
  void renderNode(node, container)
}

// Drag handlers
function onDragEnd() {
  dragOverNodeId.value = null
  dragOverPosition.value = null
  dragInsideInsertIndex.value = null
}

function parseDraggedComponent(event: DragEvent): { id: string } | null {
  const raw = event.dataTransfer?.getData('application/x-norka-proto-component')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { componentName?: string }
    if (typeof parsed.componentName === 'string') {
      return { id: parsed.componentName }
    }
    return null
  } catch {
    return null
  }
}

function parseDraggedNodeId(event: DragEvent): string | null {
  return event.dataTransfer?.getData('application/x-norka-proto-node') || null
}

function onNodeDragStart(event: DragEvent, nodeId: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-norka-proto-node', nodeId)
}

function resolveDropPosition(event: DragEvent, host: HTMLElement): 'before' | 'inside' | 'after' {
  const rect = host.getBoundingClientRect()
  const y = event.clientY - rect.top
  const ratio = y / rect.height
  if (ratio < 0.25) return 'before'
  if (ratio > 0.75) return 'after'
  return 'inside'
}

function resolveDropTarget(nodeId: string, pos: 'before' | 'inside' | 'after') {
  const node = store.getNode(nodeId)
  if (!node) return null
  if (pos === 'inside' && store.canAcceptChildren(nodeId)) {
    return { parentId: nodeId, index: store.getChildren(nodeId).length }
  }
  const parentId = node.parentId
  const siblings = parentId ? store.getChildren(parentId) : store.rootNodes.value
  const idx = siblings.findIndex((s) => s.id === nodeId)
  if (idx === -1) return null
  return { parentId, index: pos === 'after' ? idx + 1 : idx }
}

function resolveInsideInsertIndex(nodeId: string, event: DragEvent): number | null {
  const host = event.currentTarget as HTMLElement | null
  if (!host) return null
  const children = store.getChildren(nodeId)
  if (children.length === 0) return 0
  const childElements = children
    .map((child) =>
      host.querySelector<HTMLElement>(`[data-proto-node-id="${CSS.escape(child.id)}"]`)
    )
    .filter((el): el is HTMLElement => Boolean(el))
  if (childElements.length !== children.length) {
    const rect = host.getBoundingClientRect()
    const localY = event.clientY - rect.top
    return localY < rect.height / 2 ? 0 : children.length
  }
  for (let i = 0; i < childElements.length; i++) {
    const rect = childElements[i].getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    if (event.clientY < mid) return i
  }
  return childElements.length
}

function onNodeDragOver(event: DragEvent, nodeId: string) {
  event.preventDefault()
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  dragOverNodeId.value = nodeId
  dragOverPosition.value = resolveDropPosition(event, target)
  dragInsideInsertIndex.value =
    dragOverPosition.value === 'inside' ? resolveInsideInsertIndex(nodeId, event) : null
}

function onNodeDrop(event: DragEvent, nodeId: string) {
  event.preventDefault()
  event.stopPropagation()
  const host = event.currentTarget as HTMLElement | null
  const pos = dragOverPosition.value ?? (host ? resolveDropPosition(event, host) : null)
  if (!pos) return
  const target = resolveDropTarget(nodeId, pos)
  if (!target) return
  if (pos === 'inside') {
    const insideIndex = dragInsideInsertIndex.value ?? resolveInsideInsertIndex(nodeId, event)
    if (insideIndex !== null) target.index = insideIndex
  }

  const draggedNodeId = parseDraggedNodeId(event)
  const draggedComponent = parseDraggedComponent(event)
  if (draggedNodeId) {
    store.moveNode(draggedNodeId, target)
  } else if (draggedComponent) {
    store.addNodeAt(draggedComponent.id, target)
  }
  dragOverNodeId.value = null
  dragOverPosition.value = null
  dragInsideInsertIndex.value = null
}

function onCanvasDrop(event: DragEvent) {
  if (event.defaultPrevented) return
  event.preventDefault()
  const draggedNodeId = parseDraggedNodeId(event)
  const draggedComponent = parseDraggedComponent(event)
  const target = { parentId: null as string | null, index: store.rootNodes.value.length }
  if (draggedNodeId) {
    store.moveNode(draggedNodeId, target)
  } else if (draggedComponent) {
    store.addNodeAt(draggedComponent.id, target)
  }
  dragOverNodeId.value = null
  dragOverPosition.value = null
  dragInsideInsertIndex.value = null
}

function onCanvasDragOver(event: DragEvent) {
  event.preventDefault()
}

function onCanvasDragLeave(event: DragEvent) {
  if (event.currentTarget !== event.target) return
  dragOverNodeId.value = null
  dragOverPosition.value = null
}

function onNodeDragLeave(event: DragEvent, nodeId: string) {
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (current && related && current.contains(related)) return
  if (dragOverNodeId.value === nodeId) {
    dragOverPosition.value = null
    dragInsideInsertIndex.value = null
  }
}

function showInsideInsertIndicator(nodeId: string): boolean {
  return (
    dragOverNodeId.value === nodeId &&
    dragOverPosition.value === 'inside' &&
    dragInsideInsertIndex.value !== null
  )
}

function insideInsertIndicatorStyle(nodeId: string): Record<string, string> {
  const node = store.getNode(nodeId)
  if (!node) return {}
  const childrenCount = store.getChildren(nodeId).length
  const index = dragInsideInsertIndex.value ?? 0
  const ratio = childrenCount <= 0 ? 0 : Math.max(0, Math.min(index / childrenCount, 1))
  const horizontal = node.props.layoutDirection === 'horizontal'
  if (horizontal) {
    return {
      left: `calc(${(ratio * 100).toFixed(2)}% - 1px)`,
      top: '8px',
      bottom: '8px',
      width: '2px'
    }
  }
  return {
    top: `calc(${(ratio * 100).toFixed(2)}% - 1px)`,
    left: '8px',
    right: '8px',
    height: '2px'
  }
}

function onNodeClick(event: MouseEvent, fallbackId: string) {
  if (!isEditor.value) return
  const target = event.target
  const el = target instanceof HTMLElement ? target : null
  const hit = el?.closest<HTMLElement>('[data-proto-node-id]')
  const selectedNodeId = hit?.dataset.protoNodeId
  if (selectedNodeId) {
    store.selectNode(selectedNodeId)
    return
  }
  if (fallbackId) store.selectNode(null)
}

function onCanvasClick(event: MouseEvent) {
  if (!isEditor.value) return
  const target = event.target
  const el = target instanceof HTMLElement ? target : null
  const hit = el?.closest<HTMLElement>('[data-proto-node-id]')
  if (!hit) {
    store.selectNode(null)
  }
}

function nodeClass(nodeId: string) {
  const standalone = shouldRenderMount(nodeId)
  const node = store.getNode(nodeId)
  const isAssumed = node?.source === 'assumed'
  let borderClass = 'border-transparent'
  if (standalone && selectedId.value === nodeId && isEditor.value) {
    borderClass = 'border-accent/60 shadow-sm shadow-accent/10'
  } else if (standalone) {
    borderClass = 'border-border/50 hover:border-border'
  }
  return [
    isEditor.value ? 'cursor-pointer' : '',
    isAssumed ? 'ring-2 ring-pink-500/70 bg-pink-500/5' : '',
    borderClass,
    standalone && dragOverNodeId.value === nodeId && dragOverPosition.value === 'inside'
      ? 'ring-2 ring-accent/30'
      : '',
    standalone && dragOverNodeId.value === nodeId && dragOverPosition.value === 'before'
      ? 'border-t-2 border-t-accent'
      : '',
    standalone && dragOverNodeId.value === nodeId && dragOverPosition.value === 'after'
      ? 'border-b-2 border-b-accent'
      : ''
  ]
}
</script>

<template>
  <div class="flex h-full w-full min-h-0 p-6">
    <div class="flex h-full w-full min-h-0 gap-4">
      <aside
        class="flex h-full w-[249px] shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-panel/40"
      >
        <div class="flex w-12 shrink-0 self-stretch flex-col items-center gap-2 px-2 py-2">
          <div class="flex size-8 items-center justify-center rounded-md bg-hover/50 text-muted">
            <icon-lucide-panel-left class="size-4" />
          </div>
          <div class="h-6 w-8 rounded bg-hover/40" />
          <div class="h-6 w-8 rounded bg-hover/30" />
        </div>
        <div class="h-full w-px shrink-0 bg-border/70" />
        <div class="flex min-w-0 flex-1 flex-col gap-2 overflow-auto p-3">
          <template v-if="sidebarNodes.length === 0">
            <div class="h-6 w-24 rounded bg-hover/40" />
            <div class="h-5 w-full rounded bg-hover/30" />
            <div class="h-5 w-4/5 rounded bg-hover/25" />
            <div class="h-5 w-3/5 rounded bg-hover/20" />
          </template>
          <div
            v-for="entry in sidebarNodes"
            :key="entry.id"
            :ref="
              (el) => {
                const node = store.getNode(entry.id)
                if (node) onNodeRef(node, el as Element | null)
              }
            "
            class="group relative rounded-lg border transition-all"
            :class="nodeClass(entry.id)"
            :style="{ marginLeft: `${entry.depth * 12}px` }"
            @click="onNodeClick($event, entry.id)"
          >
            <div v-if="shouldRenderMount(entry.id)" data-react-mount class="pointer-events-auto" />
            <div v-else class="h-0" />
          </div>
        </div>
      </aside>

      <section class="flex min-w-0 flex-1 min-h-0 flex-col gap-4">
        <div
          class="flex h-12 shrink-0 items-center gap-2 rounded-lg border border-border/50 bg-panel/20 px-4"
        >
          <template v-if="breadcrumbNodes.length === 0">
            <div class="h-4 w-24 rounded bg-hover/45" />
            <icon-lucide-chevron-right class="size-3 text-muted/70" />
            <div class="h-4 w-20 rounded bg-hover/35" />
            <icon-lucide-chevron-right class="size-3 text-muted/70" />
            <div class="h-4 w-16 rounded bg-hover/25" />
          </template>
          <div
            v-for="entry in breadcrumbNodes"
            :key="entry.id"
            :ref="
              (el) => {
                const node = store.getNode(entry.id)
                if (node) onNodeRef(node, el as Element | null)
              }
            "
            class="group relative min-w-0 flex-1 rounded border border-transparent"
            @click="onNodeClick($event, entry.id)"
          >
            <div v-if="shouldRenderMount(entry.id)" data-react-mount class="pointer-events-auto" />
            <div v-else class="h-0" />
          </div>
        </div>

        <div
          class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto"
          @click="onCanvasClick"
          @dragover="onCanvasDragOver"
          @dragleave="onCanvasDragLeave"
          @drop="onCanvasDrop"
        >
          <div
            v-if="mainNodes.length === 0"
            class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/50 py-24 text-center"
          >
            <div class="flex size-14 items-center justify-center rounded-xl bg-hover/40 text-muted">
              <icon-lucide-layout-template class="size-7" />
            </div>
            <p class="text-sm text-muted">Добавьте компоненты из панели слева</p>
            <p class="text-[11px] text-muted/60">
              Нажмите на компонент в панели — он появится здесь
            </p>
          </div>

          <div
            v-for="entry in mainNodes"
            :key="entry.id"
            :ref="
              (el) => {
                const node = store.getNode(entry.id)
                if (node) onNodeRef(node, el as Element | null)
              }
            "
            class="group relative mt-3 rounded-lg border transition-all"
            :class="nodeClass(entry.id)"
            :style="{ marginLeft: `${entry.depth * 16}px` }"
            :draggable="isEditor"
            @click="onNodeClick($event, entry.id)"
            @dragstart="onNodeDragStart($event, entry.id)"
            @dragover.capture="onNodeDragOver($event, entry.id)"
            @dragleave.capture="onNodeDragLeave($event, entry.id)"
            @dragend="onDragEnd"
            @drop="onNodeDrop($event, entry.id)"
          >
            <!-- React mount container -->
            <div v-if="shouldRenderMount(entry.id)" data-react-mount class="pointer-events-auto" />
            <div v-else class="h-0" />
            <div
              v-if="store.getNode(entry.id)?.source === 'assumed'"
              class="pointer-events-none absolute -top-2 right-2 rounded bg-pink-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white"
            >
              {{ store.getNode(entry.id)?.assumptionLabel ?? 'Assumption' }}
            </div>
            <div
              v-if="store.getNode(entry.id)?.props.__missingComponent === true"
              class="pointer-events-none absolute -bottom-2 left-2 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-black"
            >
              missing: {{ store.getNode(entry.id)?.props.__suggestedComponent ?? 'component' }}
            </div>
            <div
              v-if="showInsideInsertIndicator(entry.id)"
              class="pointer-events-none absolute z-10 rounded bg-accent"
              :style="insideInsertIndicatorStyle(entry.id)"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
