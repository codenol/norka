import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { PRIME_PREVIEW_DEFS } from '@/composables/use-primereact-preview'

import type { ProtoStore } from '@/composables/use-proto-store'

export function createProtoAITools(store: ProtoStore) {

  const getComponentsSchema = v.object({})
  const createInstanceSchema = v.object({
    component_id: v.string('Prime preview component name, for example "Panel"'),
    parent_id: v.optional(v.nullable(v.string('Parent node id, or null for root'))),
    slot_name: v.optional(v.nullable(v.string('Optional slot name on parent'))),
  })
  const setPropsSchema = v.object({
    node_id: v.string('Target node id'),
    props: v.record(v.string(), v.unknown()),
  })
  const removeNodeSchema = v.object({
    node_id: v.string('Node id to remove'),
  })
  const describeSchema = v.object({
    limit: v.optional(v.number()),
  })
  const getSelectionSchema = v.object({})
  const moveNodeSchema = v.object({
    node_id: v.string('Node to move'),
    parent_id: v.optional(v.nullable(v.string('Target parent id, or null for root'))),
    index: v.number('Target index among siblings'),
    slot_name: v.optional(v.nullable(v.string('Optional slot name in target parent'))),
  })
  const moveBeforeSchema = v.object({
    node_id: v.string('Node to move'),
    sibling_id: v.string('Move node before this sibling'),
  })
  const moveAfterSchema = v.object({
    node_id: v.string('Node to move'),
    sibling_id: v.string('Move node after this sibling'),
  })
  const moveInsideSchema = v.object({
    node_id: v.string('Node to move'),
    parent_id: v.string('Target parent id'),
    slot_name: v.optional(v.nullable(v.string('Optional slot name in parent'))),
  })

  return {
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    get_components: (tool as any)({
      description: 'Return available PrimeReact preview components for the proto canvas.',
      inputSchema: valibotSchema(getComponentsSchema),
      execute: async () => {
        return {
          components: PRIME_PREVIEW_DEFS.map((def) => ({
            component_id: def.name,
            name: def.name,
            accepts_children: def.acceptsChildren ?? false,
            slots: def.slots ?? [],
          })),
        }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    create_instance: (tool as any)({
      description: 'Create a Prime preview component instance on proto canvas.',
      inputSchema: valibotSchema(createInstanceSchema),
      execute: async (args: {
        component_id: string
        parent_id?: string | null
        slot_name?: string | null
      }) => {
        const parentId = args.parent_id ?? null
        const index = parentId ? store.getChildren(parentId).length : store.rootNodes.value.length
        const created = store.addNodeAt(args.component_id, { parentId, index, slotName: args.slot_name ?? null })
        if (!created) {
          return { ok: false, error: `Failed to create component: ${args.component_id}` }
        }
        return {
          ok: true,
          node: {
            id: created.id,
            component: created.componentName,
            parent_id: created.parentId,
            slot_name: created.slotName ?? null,
          },
        }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    set_props: (tool as any)({
      description: 'Update component props for an existing proto canvas node.',
      inputSchema: valibotSchema(setPropsSchema),
      execute: async (args: { node_id: string; props: Record<string, unknown> }) => {
        const node = store.getNode(args.node_id)
        if (!node) return { ok: false, error: `Node not found: ${args.node_id}` }
        store.updateProps(args.node_id, args.props)
        return { ok: true }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    remove_node: (tool as any)({
      description: 'Remove a node (with its subtree) from proto canvas.',
      inputSchema: valibotSchema(removeNodeSchema),
      execute: async (args: { node_id: string }) => {
        const existing = store.getNode(args.node_id)
        if (!existing) return { ok: false, error: `Node not found: ${args.node_id}` }
        store.removeNode(args.node_id)
        return { ok: true }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    move_node: (tool as any)({
      description: 'Move an existing node to a specific parent and index.',
      inputSchema: valibotSchema(moveNodeSchema),
      execute: async (args: {
        node_id: string
        parent_id?: string | null
        index: number
        slot_name?: string | null
      }) => {
        const ok = store.moveNode(args.node_id, {
          parentId: args.parent_id ?? null,
          index: args.index,
          slotName: args.slot_name ?? null,
        })
        if (!ok) return { ok: false, error: 'Failed to move node' }
        const moved = store.getNode(args.node_id)
        return {
          ok: true,
          node: moved
            ? {
                id: moved.id,
                parent_id: moved.parentId,
                order: moved.order,
                slot_name: moved.slotName ?? null,
              }
            : null,
        }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    move_before: (tool as any)({
      description: 'Move a node before another sibling node.',
      inputSchema: valibotSchema(moveBeforeSchema),
      execute: async (args: { node_id: string; sibling_id: string }) => {
        const ok = store.moveBefore(args.node_id, args.sibling_id)
        if (!ok) return { ok: false, error: 'Failed to move node before sibling' }
        return { ok: true }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    move_after: (tool as any)({
      description: 'Move a node after another sibling node.',
      inputSchema: valibotSchema(moveAfterSchema),
      execute: async (args: { node_id: string; sibling_id: string }) => {
        const ok = store.moveAfter(args.node_id, args.sibling_id)
        if (!ok) return { ok: false, error: 'Failed to move node after sibling' }
        return { ok: true }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    move_inside: (tool as any)({
      description: 'Move a node inside a container parent (append to end).',
      inputSchema: valibotSchema(moveInsideSchema),
      execute: async (args: { node_id: string; parent_id: string; slot_name?: string | null }) => {
        const ok = store.moveInside(args.node_id, args.parent_id, args.slot_name ?? null)
        if (!ok) return { ok: false, error: 'Failed to move node inside parent' }
        return { ok: true }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    get_selection: (tool as any)({
      description: 'Return currently selected node on proto canvas.',
      inputSchema: valibotSchema(getSelectionSchema),
      execute: async () => {
        const selectedId = store.selectedId.value
        if (!selectedId) return { selected: null }
        const node = store.getNode(selectedId)
        if (!node) return { selected: null }
        return {
          selected: {
            id: node.id,
            component: node.componentName,
            parent_id: node.parentId,
            slot_name: node.slotName ?? null,
          },
        }
      },
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    describe: (tool as any)({
      description: 'Describe current proto canvas tree for verification.',
      inputSchema: valibotSchema(describeSchema),
      execute: async (args: { limit?: number }) => {
        const tree = store.toSerializedTree()
        const limit = args.limit ?? 50
        return {
          node_count: store.nodes.length,
          tree: tree.slice(0, Math.max(1, limit)),
        }
      },
    }),
  }
}

