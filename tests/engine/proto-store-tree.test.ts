import { describe, expect, it } from 'bun:test'

import { __TEST_ONLY__ } from '@/composables/use-proto-store'
import { PRIME_PREVIEW_DEFS } from '@/composables/use-primereact-preview'

describe('proto store tree model', () => {
  it('creates nested nodes and preserves parent links', () => {
    const store = __TEST_ONLY__.createProtoStore()
    const panel = PRIME_PREVIEW_DEFS.find((d) => d.name === 'Panel')
    const button = PRIME_PREVIEW_DEFS.find((d) => d.name === 'Button')
    if (!panel || !button) throw new Error('Expected test component defs')

    const root = store.addNode(panel)
    const child = store.addNode(button, { parentId: root.id, index: 0 })

    expect(store.getNode(child.id)?.parentId).toBe(root.id)
    expect(store.getChildren(root.id).map((n) => n.id)).toEqual([child.id])
  })

  it('moves nodes between parents and reindexes siblings', () => {
    const store = __TEST_ONLY__.createProtoStore()
    const panel = PRIME_PREVIEW_DEFS.find((d) => d.name === 'Panel')
    const button = PRIME_PREVIEW_DEFS.find((d) => d.name === 'Button')
    if (!panel || !button) throw new Error('Expected test component defs')

    const rootA = store.addNode(panel)
    const rootB = store.addNode(panel)
    const child = store.addNode(button, { parentId: rootA.id, index: 0 })

    const moved = store.moveNode(child.id, { parentId: rootB.id, index: 0 })
    expect(moved).toBe(true)
    expect(store.getChildren(rootA.id).length).toBe(0)
    expect(store.getChildren(rootB.id).map((n) => n.id)).toEqual([child.id])
  })

  it('rejects cyclic reparenting', () => {
    const store = __TEST_ONLY__.createProtoStore()
    const panel = PRIME_PREVIEW_DEFS.find((d) => d.name === 'Panel')
    if (!panel) throw new Error('Expected panel def')

    const root = store.addNode(panel)
    const child = store.addNode(panel, { parentId: root.id, index: 0 })

    const moved = store.moveNode(root.id, { parentId: child.id, index: 0 })
    expect(moved).toBe(false)
    expect(store.getNode(root.id)?.parentId).toBe(null)
  })

  it('supports moveBefore/moveAfter deterministic ordering', () => {
    const store = __TEST_ONLY__.createProtoStore()
    const panel = PRIME_PREVIEW_DEFS.find((d) => d.name === 'Panel')
    if (!panel) throw new Error('Expected panel def')

    const a = store.addNode(panel)
    const b = store.addNode(panel)
    const c = store.addNode(panel)

    expect(store.moveBefore(c.id, a.id)).toBe(true)
    expect(store.rootNodes.value.map((n) => n.id)).toEqual([c.id, a.id, b.id])

    expect(store.moveAfter(c.id, b.id)).toBe(true)
    expect(store.rootNodes.value.map((n) => n.id)).toEqual([a.id, b.id, c.id])
  })

  it('serializes nested tree preserving slotName', () => {
    const store = __TEST_ONLY__.createProtoStore()
    const toolbar = PRIME_PREVIEW_DEFS.find((d) => d.name === 'Toolbar')
    const button = PRIME_PREVIEW_DEFS.find((d) => d.name === 'Button')
    if (!toolbar || !button) throw new Error('Expected test component defs')

    const root = store.addNode(toolbar)
    store.addNode(button, { parentId: root.id, index: 0, slotName: 'start' })

    const tree = store.toSerializedTree()
    expect(tree.length).toBe(1)
    expect(tree[0]?.component).toBe('Toolbar')
    expect(tree[0]?.children[0]?.slotName).toBe('start')
    expect(tree[0]?.children[0]?.component).toBe('Button')
  })
})
