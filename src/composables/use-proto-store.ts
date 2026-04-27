import { reactive, ref, computed, inject, provide } from 'vue'
import { PRIME_PREVIEW_DEFS, getPrimePreviewDef } from '@/composables/use-primereact-preview'
import type { PrimePreviewDef } from '@/composables/use-primereact-preview'

export interface ProtoNode {
  id: string
  componentName: string
  importPath: string
  exportName: string
  props: Record<string, unknown>
  order: number
  parentId: string | null
  childrenIds: string[]
  slotName?: string | null
}

export interface ProtoDropTarget {
  parentId: string | null
  index: number
  slotName?: string | null
}

export interface ProtoSerializedNode {
  id: string
  component: string
  props: Record<string, unknown>
  slotName?: string | null
  children: ProtoSerializedNode[]
}

export type ProtoMode = 'editor' | 'view'

const PROTO_STORE_KEY = 'norka:proto-store'

function createProtoStore() {
  const nodes = reactive<ProtoNode[]>([])
  const selectedId = ref<string | null>(null)
  const mode = ref<ProtoMode>('editor')

  const nodeMap = computed(() => {
    const map = new Map<string, ProtoNode>()
    for (const n of nodes) map.set(n.id, n)
    return map
  })

  const selectedNode = computed<ProtoNode | null>(
    () => nodes.find((n) => n.id === selectedId.value) ?? null,
  )

  const rootNodes = computed<ProtoNode[]>(
    () => nodes.filter((n) => n.parentId === null).sort((a, b) => a.order - b.order),
  )

  const sortedNodes = computed<ProtoNode[]>(() => {
    const ordered: ProtoNode[] = []
    function visit(node: ProtoNode) {
      ordered.push(node)
      for (const child of getChildren(node.id).sort((a, b) => a.order - b.order)) {
        visit(child)
      }
    }
    for (const node of rootNodes.value) visit(node)
    return ordered
  })

  function getNode(id: string): ProtoNode | null {
    return nodeMap.value.get(id) ?? null
  }

  function getChildren(parentId: string): ProtoNode[] {
    return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order)
  }

  function getSiblings(parentId: string | null): ProtoNode[] {
    return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order)
  }

  function reindexSiblings(parentId: string | null) {
    const siblings = getSiblings(parentId)
    siblings.forEach((n, i) => { n.order = i })
    if (parentId) {
      const parent = getNode(parentId)
      if (parent) {
        parent.childrenIds = siblings.map((s) => s.id)
      }
    }
  }

  function syncAllChildrenRefs() {
    for (const node of nodes) {
      node.childrenIds = getChildren(node.id).map((child) => child.id)
    }
  }

  function isDescendant(nodeId: string, targetAncestorId: string): boolean {
    let current = getNode(nodeId)
    while (current?.parentId) {
      if (current.parentId === targetAncestorId) return true
      current = getNode(current.parentId)
    }
    return false
  }

  function canAcceptChildren(nodeId: string | null): boolean {
    if (!nodeId) return true
    const node = getNode(nodeId)
    if (!node) return false
    const def = getPrimePreviewDef(node.componentName)
    return def?.acceptsChildren === true
  }

  function normalizeTarget(target?: ProtoDropTarget): ProtoDropTarget {
    const parentId = target?.parentId ?? null
    const siblings = getSiblings(parentId)
    const index = target ? Math.max(0, Math.min(target.index, siblings.length)) : siblings.length
    return { parentId, index, slotName: target?.slotName ?? null }
  }

  function createNode(def: PrimePreviewDef, target?: ProtoDropTarget): ProtoNode {
    const normalized = normalizeTarget(target)
    const parentId = normalized.parentId
    const siblings = getSiblings(parentId)
    const index = normalized.index
    for (let i = index; i < siblings.length; i++) siblings[i].order += 1
    const node: ProtoNode = {
      id: crypto.randomUUID(),
      componentName: def.name,
      importPath: def.importPath,
      exportName: def.exportName,
      props: { ...def.previewProps },
      order: index,
      parentId,
      childrenIds: [],
      slotName: normalized.slotName ?? null,
    }
    nodes.push(node)
    syncAllChildrenRefs()
    return node
  }

  function addNode(def: PrimePreviewDef, target?: ProtoDropTarget): ProtoNode {
    return createNode(def, target)
  }

  function addNodeAt(name: string, target?: ProtoDropTarget): ProtoNode | null {
    const def = PRIME_PREVIEW_DEFS.find((d) => d.name === name)
    if (!def) return null
    if (!canAcceptChildren(target?.parentId ?? null)) return null
    return addNode(def, target)
  }

  function addNodeByName(name: string): ProtoNode | null {
    return addNodeAt(name)
  }

  function removeSubtree(rootId: string) {
    const root = getNode(rootId)
    if (!root) return
    for (const childId of root.childrenIds) removeSubtree(childId)
    const idx = nodes.findIndex((n) => n.id === rootId)
    if (idx !== -1) nodes.splice(idx, 1)
  }

  function removeNode(id: string) {
    const node = getNode(id)
    if (!node) return
    const parentId = node.parentId
    removeSubtree(id)
    if (selectedId.value === id) {
      const fallback = sortedNodes.value.at(-1)?.id ?? null
      selectedId.value = fallback
    }
    reindexSiblings(parentId)
    syncAllChildrenRefs()
  }

  function updateProps(id: string, updates: Record<string, unknown>) {
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    Object.assign(node.props, updates)
  }

  function setProp(id: string, key: string, value: unknown) {
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    node.props[key] = value
  }

  function selectNode(id: string | null) {
    selectedId.value = id
  }

  function moveNode(nodeId: string, target: ProtoDropTarget): boolean {
    const node = getNode(nodeId)
    if (!node) return false
    const normalizedTarget = normalizeTarget(target)
    if (!canAcceptChildren(normalizedTarget.parentId)) return false
    if (target.parentId === nodeId) return false
    if (normalizedTarget.parentId && isDescendant(normalizedTarget.parentId, nodeId)) return false

    const oldParentId = node.parentId
    const oldSiblings = getSiblings(oldParentId)
    const oldIndex = oldSiblings.findIndex((n) => n.id === nodeId)
    if (oldIndex === -1) return false
    oldSiblings.splice(oldIndex, 1)
    oldSiblings.forEach((s, i) => { s.order = i })

    node.parentId = normalizedTarget.parentId
    node.slotName = normalizedTarget.slotName ?? null
    const nextSiblings = getSiblings(normalizedTarget.parentId).filter((n) => n.id !== nodeId)
    const insertIndex = Math.max(0, Math.min(normalizedTarget.index, nextSiblings.length))
    nextSiblings.splice(insertIndex, 0, node)
    nextSiblings.forEach((s, i) => { s.order = i })

    reindexSiblings(oldParentId)
    reindexSiblings(normalizedTarget.parentId)
    syncAllChildrenRefs()
    return true
  }

  function moveBefore(nodeId: string, siblingId: string): boolean {
    const sibling = getNode(siblingId)
    if (!sibling) return false
    const siblings = getSiblings(sibling.parentId)
    const idx = siblings.findIndex((s) => s.id === siblingId)
    if (idx === -1) return false
    return moveNode(nodeId, { parentId: sibling.parentId, index: idx, slotName: sibling.slotName ?? null })
  }

  function moveAfter(nodeId: string, siblingId: string): boolean {
    const sibling = getNode(siblingId)
    if (!sibling) return false
    const siblings = getSiblings(sibling.parentId)
    const idx = siblings.findIndex((s) => s.id === siblingId)
    if (idx === -1) return false
    return moveNode(nodeId, { parentId: sibling.parentId, index: idx + 1, slotName: sibling.slotName ?? null })
  }

  function moveInside(nodeId: string, parentId: string, slotName?: string | null): boolean {
    if (!canAcceptChildren(parentId)) return false
    const index = getChildren(parentId).length
    return moveNode(nodeId, { parentId, index, slotName: slotName ?? null })
  }

  function serializeNode(nodeId: string): ProtoSerializedNode | null {
    const node = getNode(nodeId)
    if (!node) return null
    return {
      id: node.id,
      component: node.componentName,
      props: { ...node.props },
      slotName: node.slotName ?? null,
      children: getChildren(node.id).map((child) => serializeNode(child.id)).filter((v): v is ProtoSerializedNode => !!v),
    }
  }

  function toSerializedTree(): ProtoSerializedNode[] {
    return rootNodes.value
      .map((node) => serializeNode(node.id))
      .filter((v): v is ProtoSerializedNode => !!v)
  }

  function reorder(fromIndex: number, toIndex: number) {
    const roots = rootNodes.value
    const from = roots[fromIndex]
    moveNode(from.id, { parentId: null, index: toIndex })
  }

  function clearAll() {
    nodes.splice(0, nodes.length)
    selectedId.value = null
  }

  return {
    nodes,
    nodeMap,
    sortedNodes,
    rootNodes,
    selectedId,
    selectedNode,
    mode,
    getNode,
    getChildren,
    getSiblings,
    canAcceptChildren,
    addNode,
    addNodeAt,
    addNodeByName,
    removeNode,
    updateProps,
    setProp,
    selectNode,
    moveNode,
    moveBefore,
    moveAfter,
    moveInside,
    normalizeTarget,
    toSerializedTree,
    reorder,
    clearAll,
  }
}

export type ProtoStore = ReturnType<typeof createProtoStore>

export const __TEST_ONLY__ = {
  createProtoStore,
}

// Module-level singleton — survives HMR of this file because the store is
// created once and held in the module cache. If this module is replaced,
// child components will re-inject and get the fresh store from the parent
// anyway. The singleton is only a last-resort fallback.
let _singleton: ProtoStore | null = null

export function provideProtoStore(): ProtoStore {
  if (!_singleton) {
    _singleton = createProtoStore()
  }
  provide(PROTO_STORE_KEY, _singleton)
  return _singleton
}

export function useProtoStore(): ProtoStore {
  const store = inject<ProtoStore>(PROTO_STORE_KEY)
  if (store) return store
  // Fallback: return the singleton (used during HMR re-evaluation of child components
  // before parent re-provides, or when used outside a provider tree)
  if (!_singleton) {
    _singleton = createProtoStore()
  }
  return _singleton
}

export function injectProtoStore(): ProtoStore | null {
  return inject<ProtoStore | null>(PROTO_STORE_KEY, null)
}
