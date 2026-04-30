<script setup lang="ts">
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import * as LucideIcons from 'lucide-react'
import * as LucideVueIcons from 'lucide-vue-next'

import { normalizeComponentName } from '@/ai/screen-pipeline'
import { resolveIconPolicy, sanitizeIconName } from '@/components/design/lucide-icon-contract'
import { usePrimeTheme } from '@/composables/use-prime-theme'
import { getPrimePreviewDef, loadPrimeModule, normalizePrimeProps } from '@/composables/use-primereact-preview'
import '@/design-system/preview-runtime.scss'

interface AssemblyStepNode {
  id: string
  section: string
  component_id: string
  props: Record<string, unknown>
  slot_name?: string
  parent_step_id?: string
  children?: AssemblyStepNode[]
}

type MiniBarState = 'default' | 'hover' | 'active' | 'hover-active'

interface MiniBarItem {
  id?: string
  icon?: string
  visible?: boolean
  state?: MiniBarState
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
const isLightTheme = ref(false)
let themeObserver: MutationObserver | null = null
const { theme } = usePrimeTheme()

function toAssemblyNode(input: unknown): AssemblyStepNode | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const id = typeof raw.id === 'string' ? raw.id : ''
  const section = typeof raw.section === 'string' ? raw.section : ''
  const component_id = typeof raw.component_id === 'string' ? raw.component_id : ''
  if (!id || !section || !component_id) return null
  const props = raw.props && typeof raw.props === 'object' && !Array.isArray(raw.props)
    ? (raw.props as Record<string, unknown>)
    : {}
  const childrenRaw = Array.isArray(raw.children) ? raw.children : []
  const children = childrenRaw
    .map((child) => toAssemblyNode(child))
    .filter((child): child is AssemblyStepNode => child !== null)
  return {
    id,
    section,
    component_id,
    props,
    slot_name: typeof raw.slot_name === 'string' ? raw.slot_name : undefined,
    parent_step_id: typeof raw.parent_step_id === 'string' ? raw.parent_step_id : undefined,
    children
  }
}

function normalizeSectionNodes(rawNodes: unknown[]): AssemblyStepNode[] {
  const parsed = rawNodes
    .map((node) => toAssemblyNode(node))
    .filter((node): node is AssemblyStepNode => node !== null)
  if (parsed.length === 0) return []
  const byId = new Map<string, AssemblyStepNode>()
  const flattened: AssemblyStepNode[] = []
  const walk = (node: AssemblyStepNode) => {
    const normalized: AssemblyStepNode = { ...node, children: [] }
    byId.set(normalized.id, normalized)
    flattened.push(normalized)
    for (const child of node.children ?? []) walk(child)
  }
  for (const node of parsed) walk(node)
  const roots: AssemblyStepNode[] = []
  for (const node of flattened) {
    const parentId = node.parent_step_id
    if (!parentId) {
      roots.push(node)
      continue
    }
    const parent = byId.get(parentId)
    if (!parent || parent.section !== node.section) {
      roots.push(node)
      continue
    }
    parent.children = [...(parent.children ?? []), node]
  }
  return roots
}

function parseTreeInput(input: unknown): {
  sidebar: AssemblyStepNode[]
  breadcrumbs: AssemblyStepNode[]
  main: AssemblyStepNode[]
  actions: AssemblyStepNode[]
  meta: { miniBar?: MiniBarItem[] }
} {
  const empty = { sidebar: [], breadcrumbs: [], main: [], actions: [], meta: {} }
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
    meta?: { miniBar?: MiniBarItem[] }
  }
  return {
    sidebar: normalizeSectionNodes(Array.isArray(parsed.sidebar) ? parsed.sidebar : []),
    breadcrumbs: normalizeSectionNodes(Array.isArray(parsed.breadcrumbs) ? parsed.breadcrumbs : []),
    main: normalizeSectionNodes(Array.isArray(parsed.main) ? parsed.main : []),
    actions: normalizeSectionNodes(Array.isArray(parsed.actions) ? parsed.actions : []),
    meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}
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

const sidebarRoots = computed(() => {
  let hasSidebarPanel = false
  return parsedTree.value.sidebar.filter((node) => {
    const normalized = normalizeComponentName(node.component_id)
    const isSidebarPanel = normalized === 'DesignSystemSidebarPanel' || normalized === 'sidebar_panel'
    if (!isSidebarPanel) return true
    if (hasSidebarPanel) return false
    hasSidebarPanel = true
    return true
  })
})
const breadcrumbRoots = computed(() => parsedTree.value.breadcrumbs)
const mainRoots = computed(() => [...parsedTree.value.main, ...parsedTree.value.actions])
const miniBarItems = computed(() => {
  const iconPolicy = resolveIconPolicy(parsedTree.value.meta)
  const configured = Array.isArray(parsedTree.value.meta.miniBar) ? parsedTree.value.meta.miniBar : []
  const fallbackDefaults: MiniBarItem[] = [
    { id: 'mini-circle', icon: 'circle', state: 'default', visible: true },
    { id: 'mini-layout-grid', icon: 'layout-grid', state: 'default', visible: true }
  ]
  const source = configured.length > 0 ? configured : fallbackDefaults
  return source
    .map((item, index) => {
      const stateValue =
        item.state === 'hover' || item.state === 'active' || item.state === 'hover-active'
          ? item.state
          : 'default'
      const icon = sanitizeIconName(item.icon, iconPolicy) ?? iconPolicy.fallbackIcon
      return {
        id: item.id ?? `mini-${index}`,
        icon,
        visible: item.visible !== false,
        state: stateValue
      } satisfies Required<Pick<MiniBarItem, 'id' | 'icon' | 'visible' | 'state'>>
    })
    .filter((item) => item.visible)
})

function kebabToPascal(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join('')
}

function getMiniIconComponent(iconName: string) {
  const key = kebabToPascal(iconName)
  return (LucideVueIcons as Record<string, unknown>)[key] ?? LucideVueIcons.Circle
}

function renderLucideIcon(iconName: string, className = 'size-4'): unknown {
  const key = kebabToPascal(iconName)
  const Icon = (LucideIcons as Record<string, unknown>)[key]
  if (!Icon) return null
  return createElement(Icon as never, { className, size: 16, strokeWidth: 1.8 } as never)
}

function toggleTheme() {
  theme.value = theme.value === 'lara-light-blue' ? 'lara-dark-blue' : 'lara-light-blue'
}

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
  if (normalizeComponentName(node.component_id).toLowerCase() === 'frame') {
    const direction = node.props.layout === 'horizontal' ? 'row' : 'column'
    const alignItems = typeof node.props.alignItems === 'string' ? node.props.alignItems : 'stretch'
    const justifyContent = typeof node.props.justifyContent === 'string' ? node.props.justifyContent : 'flex-start'
    const gap = typeof node.props.gap === 'number' ? `${node.props.gap}px` : '8px'
    const padding = typeof node.props.padding === 'number' ? `${node.props.padding}px` : '0'
    const width = typeof node.props.width === 'string' ? node.props.width : '100%'
    const childNodes = childrenByParent.value.get(node.id) ?? []
    const childElements = (
      await Promise.all(childNodes.map((child) => createRuntimeSubtree(child)))
    ).filter((value): value is unknown => value !== null)
    return createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: direction,
          alignItems,
          justifyContent,
          gap,
          padding,
          width
        }
      },
      ...(childElements as never[])
    )
  }
  const normalizedComponentIdBase = normalizeComponentName(node.component_id)
  const isPageHeaderNode =
    (node.id.includes('header-title') || node.id.includes('page-header')) &&
    typeof node.props.title === 'string'
  const isSidebarPanelNode =
    node.section === 'sidebar' &&
    (node.id.includes('sidebar-summary') || node.id.includes('sidebar-main') || node.id.includes('contract-sidebar')) &&
    (normalizedComponentIdBase === 'Card' || normalizedComponentIdBase === 'Panel')
  const normalizedComponentId = isPageHeaderNode && normalizedComponentIdBase === 'Card'
    ? 'DesignSystemPageHeader'
    : isSidebarPanelNode
      ? 'DesignSystemSidebarPanel'
    : normalizedComponentIdBase
  const primaryDef = getPrimePreviewDef(normalizedComponentId)
  const resolvedComponentId = primaryDef?.name ?? normalizedComponentId
  const fallbackComponentId = primaryDef?.llm?.fallbackComponent
  const fallbackDef = fallbackComponentId ? getPrimePreviewDef(fallbackComponentId) : null
  const resolvedDef = primaryDef ?? fallbackDef
  if (!resolvedDef) return null
  const mod = await loadModuleCached(resolvedDef.name)
  if (!mod) return null
  const Comp = mod[resolvedDef.exportName]
  if (!Comp) return null
  const normalizedProps = normalizePrimeProps(resolvedDef.name, node.props)
  if (resolvedDef.name === 'DesignSystemSidebarPanel') {
    const items = Array.isArray((normalizedProps as { items?: unknown[] }).items)
      ? (normalizedProps as { items?: unknown[] }).items
      : []
    if (items.length === 0) {
      ;(normalizedProps as { items: Array<Record<string, unknown>> }).items = [
        { id: 'overview', label: 'Обзор', icon: 'circle', selected: true }
      ]
    }
  }
  const iconPolicy = resolveIconPolicy(parsedTree.value.meta)
  const icon = sanitizeIconName(node.props.icon, iconPolicy)
  const iconLeft = sanitizeIconName(node.props.iconLeft, iconPolicy)
  const iconRight = sanitizeIconName(node.props.iconRight, iconPolicy)
  const nodeChildren = childrenByParent.value.get(node.id) ?? []
  const childElements = (
    await Promise.all(nodeChildren.map((child) => createRuntimeSubtree(child)))
  ).filter((value): value is unknown => value !== null)
  if (!resolvedDef.acceptsChildren || childElements.length === 0) {
    const baseElement = createElement(Comp as never, normalizedProps as never)
    if (!icon && !iconLeft && !iconRight) return baseElement
    const leading = renderLucideIcon(iconLeft ?? icon ?? '', 'size-4 text-muted')
    const trailing = iconRight ? renderLucideIcon(iconRight, 'size-4 text-muted') : null
    return createElement(
      'div',
      { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
      ...(leading ? [leading as never] : []),
      baseElement as never,
      ...(trailing ? [trailing as never] : [])
    )
  }
  const nextProps = { ...normalizedProps }
  if (resolvedDef.slots && resolvedDef.slots.some((slot) => slot !== 'default')) {
    const bySlot = new Map<string, unknown[]>()
    for (let i = 0; i < nodeChildren.length; i++) {
      const slot = nodeChildren[i]?.slot_name ?? 'default'
      const value = childElements[i]
      if (!value) continue
      const bucket = bySlot.get(slot) ?? []
      bucket.push(value)
      bySlot.set(slot, bucket)
    }
    for (const slotName of resolvedDef.slots) {
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
    if (!primaryDef && fallbackDef) {
      nextProps['data-render-fallback'] = resolvedComponentId
    }
    return createElement(Comp as never, nextProps as never, ...(defaultChildren as never[]))
  }
  if (!primaryDef && fallbackDef) {
    nextProps['data-render-fallback'] = resolvedComponentId
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

function onNodeRef(node: AssemblyStepNode, el: unknown) {
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

onMounted(() => {
  const syncTheme = () => {
    const datasetTheme = document.documentElement.dataset.primeTheme ?? ''
    const bodyHasLight = document.body.classList.contains('layout-theme-light')
    isLightTheme.value = bodyHasLight || datasetTheme.includes('light')
  }
  syncTheme()
  themeObserver = new MutationObserver(() => syncTheme())
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-prime-theme'] })
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  for (const container of idToContainer.values()) {
    containerRootMap.get(container)?.unmount()
  }
  idToContainer.clear()
  moduleCache.clear()
  themeObserver?.disconnect()
  themeObserver = null
})

const hasMain = computed(() =>
  mainRoots.value.length > 0
)
</script>

<template>
  <div class="ds-preview-root flex h-full w-full min-h-0 p-6">
    <div class="flex h-full w-full min-h-0 gap-4">
      <aside class="ds-sidebar-shell flex h-full w-[249px] shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-panel/40">
        <div class="ds-fixed-minibar w-12 shrink-0 self-stretch">
          <div class="ds-fixed-minibar__content">
            <div class="ds-fixed-minibar__stack">
              <button
                v-for="item in miniBarItems"
                :key="item.id"
                class="ds-fixed-minibar__icon-btn"
                :class="`is-${item.state}`"
                :aria-label="item.id"
              >
                <component :is="getMiniIconComponent(item.icon)" class="size-5" :stroke-width="1.8" />
              </button>
            </div>
            <div class="ds-fixed-minibar__fixed-bottom">
              <button
                class="ds-fixed-minibar__icon-btn is-default"
                aria-label="theme"
                @click="toggleTheme"
              >
                <icon-lucide-sun
                  v-if="isLightTheme"
                  class="size-5"
                />
                <icon-lucide-moon
                  v-else
                  class="size-5"
                />
              </button>
              <button class="ds-fixed-minibar__avatar" aria-label="avatar">AB</button>
            </div>
          </div>
        </div>
        <div class="h-full w-px shrink-0 bg-border/70" />
        <div class="ds-sidebar-content flex min-w-0 flex-1 flex-col overflow-auto">
          <template v-if="sidebarRoots.length === 0">
            <div class="h-6 w-24 rounded bg-hover/40" />
            <div class="h-5 w-full rounded bg-hover/30" />
            <div class="h-5 w-4/5 rounded bg-hover/25" />
          </template>
          <div
            v-for="node in sidebarRoots"
            :key="node.id"
            :data-node-id="node.id"
            :ref="(el) => onNodeRef(node, el)"
            class="ds-sidebar-slot rounded-lg border border-transparent"
          />
        </div>
      </aside>

      <section class="flex min-w-0 flex-1 min-h-0 flex-col gap-4">
        <div class="ds-breadcrumbs-shell inline-flex w-fit max-w-full shrink-0 items-center gap-2 self-start rounded-2xl border py-4 pl-6 pr-5">
          <template v-if="breadcrumbRoots.length === 0">
            <div class="h-4 w-24 rounded bg-hover/45" />
            <icon-lucide-chevron-right class="size-3 text-muted/70" />
            <div class="h-4 w-20 rounded bg-hover/35" />
          </template>
          <div
            v-for="node in breadcrumbRoots"
            :key="node.id"
            :data-node-id="node.id"
            :ref="(el) => onNodeRef(node, el)"
            class="min-w-0 shrink-0"
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
            :data-node-id="node.id"
            :ref="(el) => onNodeRef(node, el)"
            class="mt-3 rounded-lg border border-transparent"
          />
        </div>
      </section>
    </div>
  </div>
</template>
