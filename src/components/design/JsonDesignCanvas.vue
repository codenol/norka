<script setup lang="ts">
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { computed, onUnmounted, ref, watch } from 'vue'

import { getPrimePreviewDef, loadPrimeModule, normalizePrimeProps } from '@/composables/use-primereact-preview'

interface AssemblyStepNode {
  id: string
  section: string
  component_id: string
  props: Record<string, unknown>
  slot_name?: string
  parent_step_id?: string
  children?: AssemblyStepNode[]
}

const props = defineProps({
  treeJson: {
    type: [String, Object],
    default: ''
  }
})

const containerRootMap = new WeakMap<HTMLDivElement, Root>()
const idToContainer = new Map<string, HTMLDivElement>()
const moduleCache = new Map<string, Record<string, unknown> | null>()

function parseTreeInput(input: unknown): {
  sidebar: AssemblyStepNode[]
  breadcrumbs: AssemblyStepNode[]
  main: AssemblyStepNode[]
  actions: AssemblyStepNode[]
} {
  const empty = { sidebar: [], breadcrumbs: [], main: [], actions: [] }
  if (!input) return empty
  let raw: unknown = input
  if (typeof raw === 'object' && raw !== null && 'value' in (raw as Record<string, unknown>)) {
    raw = (raw as { value?: unknown }).value
  }
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return empty
    }
  }
  if (!raw || typeof raw !== 'object') return empty
  const parsed = raw as {
    sidebar?: AssemblyStepNode[]
    breadcrumbs?: AssemblyStepNode[]
    main?: AssemblyStepNode[]
    actions?: AssemblyStepNode[]
  }
  return {
    sidebar: Array.isArray(parsed.sidebar) ? parsed.sidebar : [],
    breadcrumbs: Array.isArray(parsed.breadcrumbs) ? parsed.breadcrumbs : [],
    main: Array.isArray(parsed.main) ? parsed.main : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : []
  }
}

const parsedTree = computed(() => {
  return parseTreeInput(props.treeJson)
})
const byId = computed(() => {
  const map = new Map<string, AssemblyStepNode>()
  const flatten = (nodes: AssemblyStepNode[]) => {
    for (const node of nodes) {
      map.set(node.id, node)
      if (Array.isArray((node as { children?: AssemblyStepNode[] }).children)) {
        flatten((node as { children?: AssemblyStepNode[] }).children ?? [])
      }
    }
  }
  flatten(parsedTree.value.sidebar)
  flatten(parsedTree.value.breadcrumbs)
  flatten(parsedTree.value.main)
  flatten(parsedTree.value.actions)
  return map
})

const childrenByParent = computed(() => {
  const out = new Map<string, AssemblyStepNode[]>()
  for (const node of byId.value.values()) {
    const children = (node as { children?: AssemblyStepNode[] }).children
    if (!Array.isArray(children) || children.length === 0) continue
    out.set(node.id, children)
  }
  return out
})

const sidebarRoots = computed(() => parsedTree.value.sidebar)
const breadcrumbRoots = computed(() => parsedTree.value.breadcrumbs)
const mainRoots = computed(() => [...parsedTree.value.main, ...parsedTree.value.actions])

function getOrCreateRoot(container: HTMLDivElement): Root {
  const existing = containerRootMap.get(container)
  if (existing) return existing
  const root = createRoot(container)
  containerRootMap.set(container, root)
  return root
}

async function loadModuleCached(componentName: string): Promise<Record<string, unknown> | null> {
  const def = getPrimePreviewDef(componentName)
  if (!def) return null
  if (moduleCache.has(def.importPath)) return moduleCache.get(def.importPath) ?? null
  const mod = await loadPrimeModule(def.importPath)
  moduleCache.set(def.importPath, mod)
  return mod
}

async function createRuntimeSubtree(node: AssemblyStepNode): Promise<unknown | null> {
  const normalizedComponentId =
    node.component_id === 'Breadcrum' || node.component_id === 'BreadCrumb'
      ? 'Breadcrumb'
      : node.component_id
  const def = getPrimePreviewDef(normalizedComponentId)
  if (!def) return null
  const mod = await loadModuleCached(normalizedComponentId)
  if (!mod) return null
  const Comp = mod[def.exportName]
  if (!Comp) return null
  const normalizedProps = normalizePrimeProps(normalizedComponentId, node.props)
  const nodeChildren = childrenByParent.value.get(node.id) ?? []
  const childElements = (
    await Promise.all(nodeChildren.map((child) => createRuntimeSubtree(child)))
  ).filter((value): value is unknown => value !== null)
  if (!def.acceptsChildren || childElements.length === 0) {
    return createElement(Comp as never, normalizedProps as never)
  }
  const nextProps = { ...normalizedProps }
  if (def.slots && def.slots.some((slot) => slot !== 'default')) {
    const bySlot = new Map<string, unknown[]>()
    for (let i = 0; i < nodeChildren.length; i++) {
      const slot = nodeChildren[i]?.slot_name ?? 'default'
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
      nextProps[slotName] = () =>
        createElement(
          'div',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
          ...(slotElements as never[])
        )
    }
    const defaultChildren = bySlot.get('default') ?? []
    return createElement(Comp as never, nextProps as never, ...(defaultChildren as never[]))
  }
  return createElement(Comp as never, nextProps as never, ...(childElements as never[]))
}

async function renderNode(node: AssemblyStepNode, container: HTMLDivElement) {
  const element = await createRuntimeSubtree(node)
  idToContainer.set(node.id, container)
  const root = getOrCreateRoot(container)
  if (element === null) {
    root.render(
      createElement(
        'div',
        {
          style: {
            border: '1px dashed var(--p-surface-400, #94a3b8)',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '12px',
            color: 'var(--p-text-muted-color, #64748b)'
          }
        },
        `Component unavailable: ${node.component_id}`
      ) as never
    )
    return
  }
  root.render(element as never)
}

function onNodeRef(node: AssemblyStepNode, el: Element | null) {
  if (!(el instanceof HTMLDivElement)) {
    const previous = idToContainer.get(node.id)
    if (previous) {
      containerRootMap.get(previous)?.unmount()
      idToContainer.delete(node.id)
    }
    return
  }
  void renderNode(node, el)
}

watch(
  () => props.treeJson,
  async () => {
    for (const [id, container] of idToContainer.entries()) {
      const node = byId.value.get(id)
      if (!node) {
        containerRootMap.get(container)?.unmount()
        idToContainer.delete(id)
        continue
      }
      await renderNode(node, container)
    }
  },
  { deep: true, immediate: true }
)

onUnmounted(() => {
  for (const container of idToContainer.values()) {
    containerRootMap.get(container)?.unmount()
  }
  idToContainer.clear()
  moduleCache.clear()
})

const hasMain = computed(() =>
  mainRoots.value.length > 0
)
</script>

<template>
  <div class="flex h-full w-full min-h-0 p-6">
    <div class="flex h-full w-full min-h-0 gap-4">
      <aside class="flex h-full w-[249px] shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-panel/40">
        <div class="flex w-12 shrink-0 self-stretch flex-col items-center gap-2 px-2 py-2">
          <div class="flex size-8 items-center justify-center rounded-md bg-hover/50 text-muted">
            <icon-lucide-panel-left class="size-4" />
          </div>
          <div class="h-6 w-8 rounded bg-hover/40" />
          <div class="h-6 w-8 rounded bg-hover/30" />
        </div>
        <div class="h-full w-px shrink-0 bg-border/70" />
        <div class="flex min-w-0 flex-1 flex-col gap-2 overflow-auto p-3">
          <template v-if="sidebarRoots.length === 0">
            <div class="h-6 w-24 rounded bg-hover/40" />
            <div class="h-5 w-full rounded bg-hover/30" />
            <div class="h-5 w-4/5 rounded bg-hover/25" />
          </template>
          <div
            v-for="node in sidebarRoots"
            :key="node.id"
            :ref="(el) => onNodeRef(node, el)"
            class="rounded-lg border border-transparent"
          />
        </div>
      </aside>

      <section class="flex min-w-0 flex-1 min-h-0 flex-col gap-4">
        <div class="flex h-12 shrink-0 items-center gap-2 rounded-lg border border-border/50 bg-panel/20 px-4">
          <template v-if="breadcrumbRoots.length === 0">
            <div class="h-4 w-24 rounded bg-hover/45" />
            <icon-lucide-chevron-right class="size-3 text-muted/70" />
            <div class="h-4 w-20 rounded bg-hover/35" />
          </template>
          <div
            v-for="node in breadcrumbRoots"
            :key="node.id"
            :ref="(el) => onNodeRef(node, el)"
            class="min-w-0 flex-1"
          />
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          <div
            v-if="!hasMain"
            class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/50 py-24 text-center"
          >
            <div class="flex size-14 items-center justify-center rounded-xl bg-hover/40 text-muted">
              <icon-lucide-layout-template class="size-7" />
            </div>
            <p class="text-sm text-muted">Main zone is empty for current JSON contract</p>
          </div>
          <div
            v-for="node in mainRoots"
            :key="node.id"
            :ref="(el) => onNodeRef(node, el)"
            class="mt-3 rounded-lg border border-transparent"
          />
        </div>
      </section>
    </div>
  </div>
</template>
