import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import {
  PRIME_PREVIEW_DEFS,
  getPrimeComponentContract,
  getPrimeCoverageForDemoScenes,
  getPrimeCoverageSnapshot
} from '@/composables/use-primereact-preview'
import { evaluateQualityGate } from '@/ai/screen-pipeline'

import type { ProtoStore } from '@/composables/use-proto-store'

export function createProtoAITools(store: ProtoStore) {
  const getComponentsSchema = v.object({})
  const createInstanceSchema = v.object({
    component_id: v.string('Prime preview component name, for example "Panel"'),
    parent_id: v.optional(v.nullable(v.string('Parent node id, or null for root'))),
    slot_name: v.optional(v.nullable(v.string('Optional slot name on parent')))
  })
  const setPropsSchema = v.object({
    node_id: v.string('Target node id'),
    props: v.record(v.string(), v.unknown())
  })
  const removeNodeSchema = v.object({
    node_id: v.string('Node id to remove')
  })
  const applyStatePresetSchema = v.object({
    node_id: v.string('Target node id'),
    state: v.string('State preset name, for example healthy, warning, critical')
  })
  const markAssumptionSchema = v.object({
    node_id: v.string('Target node id'),
    assumed: v.boolean('Whether node represents AI assumption'),
    label: v.optional(v.string('Optional assumption label shown on canvas'))
  })
  const describeSchema = v.object({
    limit: v.optional(v.number())
  })
  const componentFitSchema = v.object({
    blocks: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        archetype_id: v.optional(v.nullable(v.string())),
        preferred_component: v.optional(v.nullable(v.string()))
      })
    )
  })
  const getSelectionSchema = v.object({})
  const moveNodeSchema = v.object({
    node_id: v.string('Node to move'),
    parent_id: v.optional(v.nullable(v.string('Target parent id, or null for root'))),
    index: v.number('Target index among siblings'),
    slot_name: v.optional(v.nullable(v.string('Optional slot name in target parent')))
  })
  const moveBeforeSchema = v.object({
    node_id: v.string('Node to move'),
    sibling_id: v.string('Move node before this sibling')
  })
  const moveAfterSchema = v.object({
    node_id: v.string('Node to move'),
    sibling_id: v.string('Move node after this sibling')
  })
  const moveInsideSchema = v.object({
    node_id: v.string('Node to move'),
    parent_id: v.string('Target parent id'),
    slot_name: v.optional(v.nullable(v.string('Optional slot name in parent')))
  })
  const buildLayoutScaffoldSchema = v.object({
    sections: v.array(v.string('Section ids to scaffold'))
  })
  const runAssemblyStepsSchema = v.object({
    section_node_map: v.record(v.string(), v.string()),
    steps: v.array(
      v.object({
        id: v.string(),
        section: v.string(),
        component_id: v.string(),
        parent_section_id: v.optional(v.nullable(v.string())),
        parent_step_id: v.optional(v.nullable(v.string())),
        slot_name: v.optional(v.nullable(v.string())),
        props: v.optional(v.record(v.string(), v.unknown()))
      })
    )
  })
  const validateQualityGateSchema = v.object({
    required_sections: v.array(v.string()),
    min_node_count: v.optional(v.number()),
    repair_attempts: v.optional(v.number()),
    expected_step_ids: v.optional(v.array(v.string())),
    expected_table_rows_min: v.optional(v.number()),
    expected_table_columns_min: v.optional(v.number())
  })
  const deterministicAssembleSchema = v.object({
    sections: v.array(v.string()),
    steps: v.array(
      v.object({
        id: v.string(),
        section: v.string(),
        component_id: v.string(),
        parent_section_id: v.optional(v.nullable(v.string())),
        props: v.optional(v.record(v.string(), v.unknown()))
      })
    )
  })

  return {
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    get_components: (tool as any)({
      description: 'Return available PrimeReact preview components for the proto canvas.',
      inputSchema: valibotSchema(getComponentsSchema),
      execute: async () => {
        return {
          mode: 'editor',
          coverage: getPrimeCoverageSnapshot(),
          demoScenes: getPrimeCoverageForDemoScenes(),
          components: PRIME_PREVIEW_DEFS.map((def) => ({
            component_id: def.name,
            name: def.name,
            accepts_children: def.acceptsChildren ?? false,
            slots: def.slots ?? [],
            archetype_id: def.archetypeId ?? null,
            props: Object.entries(def.propSchema ?? {}).map(([name, schema]) => ({
              name,
              type: schema.type,
              options: schema.options ?? []
            })),
            state_presets: Object.keys(def.statePresets ?? {})
            ,
            fallback_component_id: def.llm?.fallbackComponent ?? 'Panel'
          }))
        }
      }
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
        const requestedParentId = args.parent_id ?? null
        const resolvedParentId =
          requestedParentId && !store.canAcceptChildren(requestedParentId) ? null : requestedParentId
        const index = resolvedParentId
          ? store.getChildren(resolvedParentId).length
          : store.rootNodes.value.length
        const created = store.addNodeAt(args.component_id, {
          parentId: resolvedParentId,
          index,
          slotName: args.slot_name ?? null
        })
        if (!created) {
          return {
            ok: false,
            error_code: 'create_component_failed',
            error: `Failed to create component: ${args.component_id}`
          }
        }
        return {
          ok: true,
          node: {
            id: created.id,
            component: created.componentName,
            parent_id: created.parentId,
            slot_name: created.slotName ?? null
          }
        }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    set_props: (tool as any)({
      description: 'Update component props for an existing proto canvas node.',
      inputSchema: valibotSchema(setPropsSchema),
      execute: async (args: { node_id: string; props: Record<string, unknown> }) => {
        const node = store.getNode(args.node_id)
        if (!node) return { ok: false, error: `Node not found: ${args.node_id}` }
        const contract = getPrimeComponentContract(node.componentName)
        store.updateProps(args.node_id, args.props)
        const nextNode = store.getNode(args.node_id)
        const appliedKeys = Object.keys(args.props).filter((key) => key in (nextNode?.props ?? {}))
        const rejectedKeys = Object.keys(args.props).filter((key) => !appliedKeys.includes(key))
        return {
          ok: true,
          applied_keys: appliedKeys,
          rejected_keys: rejectedKeys,
          archetype_id: contract?.def.archetypeId ?? null
        }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    apply_state_preset: (tool as any)({
      description:
        'Apply a named visual state preset to a node (for example healthy, warning, critical).',
      inputSchema: valibotSchema(applyStatePresetSchema),
      execute: async (args: { node_id: string; state: string }) => {
        const node = store.getNode(args.node_id)
        if (!node) return { ok: false, error: `Node not found: ${args.node_id}` }
        const contract = getPrimeComponentContract(node.componentName)
        const available = Object.keys(contract?.def.statePresets ?? {})
        if (!available.includes(args.state)) {
          return {
            ok: false,
            error: `State preset "${args.state}" is not available for ${node.componentName}`,
            available_states: available
          }
        }
        store.applyStatePreset(args.node_id, args.state)
        return { ok: true, applied_state: args.state }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    mark_assumption: (tool as any)({
      description:
        'Mark/unmark node as assumed data. Assumed nodes are highlighted in canvas and preview.',
      inputSchema: valibotSchema(markAssumptionSchema),
      execute: async (args: { node_id: string; assumed: boolean; label?: string }) => {
        const node = store.getNode(args.node_id)
        if (!node) return { ok: false, error: `Node not found: ${args.node_id}` }
        store.setAssumption(args.node_id, args.assumed, args.label ?? null)
        return { ok: true }
      }
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
      }
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
        if (args.parent_id && !store.canAcceptChildren(args.parent_id)) {
          return {
            ok: false,
            error_code: 'parent_not_container',
            error: `Target parent cannot accept children: ${args.parent_id}`
          }
        }
        const ok = store.moveNode(args.node_id, {
          parentId: args.parent_id ?? null,
          index: args.index,
          slotName: args.slot_name ?? null
        })
        if (!ok) return { ok: false, error_code: 'move_failed', error: 'Failed to move node' }
        const moved = store.getNode(args.node_id)
        return {
          ok: true,
          node: moved
            ? {
                id: moved.id,
                parent_id: moved.parentId,
                order: moved.order,
                slot_name: moved.slotName ?? null
              }
            : null
        }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    move_before: (tool as any)({
      description: 'Move a node before another sibling node.',
      inputSchema: valibotSchema(moveBeforeSchema),
      execute: async (args: { node_id: string; sibling_id: string }) => {
        const ok = store.moveBefore(args.node_id, args.sibling_id)
        if (!ok) {
          return {
            ok: false,
            error_code: 'move_before_failed',
            error: 'Failed to move node before sibling'
          }
        }
        return { ok: true }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    move_after: (tool as any)({
      description: 'Move a node after another sibling node.',
      inputSchema: valibotSchema(moveAfterSchema),
      execute: async (args: { node_id: string; sibling_id: string }) => {
        const ok = store.moveAfter(args.node_id, args.sibling_id)
        if (!ok) {
          return {
            ok: false,
            error_code: 'move_after_failed',
            error: 'Failed to move node after sibling'
          }
        }
        return { ok: true }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    move_inside: (tool as any)({
      description: 'Move a node inside a container parent (append to end).',
      inputSchema: valibotSchema(moveInsideSchema),
      execute: async (args: { node_id: string; parent_id: string; slot_name?: string | null }) => {
        if (!store.canAcceptChildren(args.parent_id)) {
          return {
            ok: false,
            error_code: 'parent_not_container',
            error: `Target parent cannot accept children: ${args.parent_id}`
          }
        }
        const ok = store.moveInside(args.node_id, args.parent_id, args.slot_name ?? null)
        if (!ok) {
          return {
            ok: false,
            error_code: 'move_inside_failed',
            error: 'Failed to move node inside parent'
          }
        }
        return { ok: true }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    build_layout_scaffold: (tool as any)({
      description: 'Create mandatory layout scaffold sections before content composition.',
      inputSchema: valibotSchema(buildLayoutScaffoldSchema),
      execute: async (args: { sections: string[] }) => {
        const created: Array<{ section: string; node_id: string }> = []
        const sectionNodeMap: Record<string, string> = {}
        const root = store.addNodeAt('Panel', { parentId: null, index: store.rootNodes.value.length })
        if (!root) return { ok: false, error: 'Failed to create scaffold root' }
        store.updateProps(root.id, { header: '', __scaffoldRoot: true })
        for (const section of args.sections) {
          const node = store.addNodeAt('Panel', {
            parentId: root.id,
            index: store.getChildren(root.id).length
          })
          if (!node) continue
          store.updateProps(node.id, { header: '', __scaffoldSection: section, __section: section })
          sectionNodeMap[section] = node.id
          created.push({ section, node_id: node.id })
        }
        return { ok: true, root_id: root.id, sections: created, section_node_map: sectionNodeMap }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    run_assembly_steps: (tool as any)({
      description: 'Run deterministic assembly steps sequentially with per-step validation.',
      inputSchema: valibotSchema(runAssemblyStepsSchema),
      execute: async (args: {
        section_node_map: Record<string, string>
        steps: Array<{
          id: string
          section: string
          component_id: string
          parent_section_id?: string | null
          parent_step_id?: string | null
          slot_name?: string | null
          props?: Record<string, unknown>
        }>
      }) => {
        const stepNodeMap = new Map<string, string>()
        const failedSteps: string[] = []
        const unresolvedParentLinks: string[] = []
        const executed: Array<{ step_id: string; node_id: string }> = []
        for (const step of args.steps) {
          const parentFromStep =
            step.parent_step_id ? (stepNodeMap.get(step.parent_step_id) ?? null) : null
          const parentFromSection = args.section_node_map[step.parent_section_id ?? step.section] ?? null
          const resolvedParent = parentFromStep ?? parentFromSection
          if (!resolvedParent || !store.canAcceptChildren(resolvedParent)) {
            failedSteps.push(step.id)
            unresolvedParentLinks.push(step.id)
            continue
          }
          const componentId = PRIME_PREVIEW_DEFS.some((def) => def.name === step.component_id)
            ? step.component_id
            : 'Panel'
          const node = store.addNodeAt(componentId, {
            parentId: resolvedParent,
            index: store.getChildren(resolvedParent).length,
            slotName: step.slot_name ?? null
          })
          if (!node) {
            failedSteps.push(step.id)
            continue
          }
          store.updateProps(node.id, {
            ...(step.props ?? {}),
            __section: step.section,
            __stepId: step.id,
            ...(componentId === 'Panel' && componentId !== step.component_id
              ? {
                  __missingComponent: true,
                  __missingReason: `Fallback for ${step.component_id}`,
                  __suggestedComponent: step.component_id
                }
              : {})
          })
          executed.push({ step_id: step.id, node_id: node.id })
          stepNodeMap.set(step.id, node.id)
        }
        return {
          ok: failedSteps.length === 0,
          executed,
          failed_steps: failedSteps,
          unresolved_parent_links: unresolvedParentLinks
        }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    validate_quality_gate: (tool as any)({
      description:
        'Validate screen completeness gate. Use after assembly. If failed, run repair and re-check.',
      inputSchema: valibotSchema(validateQualityGateSchema),
      execute: async (args: {
        required_sections: string[]
        min_node_count?: number
        repair_attempts?: number
        expected_step_ids?: string[]
        expected_table_rows_min?: number
        expected_table_columns_min?: number
      }) => {
        const serialized = store.toSerializedTree()
        const presentSections = new Set<string>()
        const missingComponentIds: string[] = []
        let unresolvedParentLinks = 0
        let hasTable = false
        let hasFilters = false
        let hasActions = false
        let hasSidebarContent = false
        let hasBreadcrumbsContent = false
        let tableRowCount = 0
        let tableColumnCount = 0
        const tableColumns = new Set<string>()
        const stepIdsOnCanvas = new Set<string>()
        const stack = [...serialized]
        while (stack.length > 0) {
          const current = stack.pop()
          if (!current) continue
          const stepId = current.props?.__stepId
          if (typeof stepId === 'string' && stepId.trim()) stepIdsOnCanvas.add(stepId)
          const section = (current.props?.__section ?? current.props?.__scaffoldSection) as unknown
          if (typeof section === 'string' && section.trim()) presentSections.add(section)
          if (current.componentName === 'DataTable') {
            hasTable = true
            const value = current.props?.value as unknown
            if (Array.isArray(value)) tableRowCount = Math.max(tableRowCount, value.length)
          }
          if (current.componentName === 'Column') {
            tableColumnCount += 1
            const field = current.props?.field
            if (typeof field === 'string' && field.trim()) tableColumns.add(field.trim().toLowerCase())
          }
          if (current.componentName === 'Dropdown' || current.componentName === 'Calendar') hasFilters = true
          if (current.componentName === 'Toolbar' || current.componentName === 'Button') hasActions = true
          if (section === 'sidebar') hasSidebarContent = true
          if (section === 'breadcrumbs') hasBreadcrumbsContent = true
          if (current.props?.__missingComponent === true) missingComponentIds.push(current.id)
          if (current.props?.__unresolvedParent === true) unresolvedParentLinks += 1
          stack.push(...current.children)
        }
        const requiredRows = args.expected_table_rows_min ?? 10
        const requiredColumns = args.expected_table_columns_min ?? 4
        const domainColumnsPresent = tableColumnCount >= requiredColumns
        const expectedStepIds = Array.isArray(args.expected_step_ids) ? args.expected_step_ids : []
        const jsonStructureMatch = expectedStepIds.every((id) => stepIdsOnCanvas.has(id))
        const minNodeCount = args.min_node_count ?? 6
        const gate = evaluateQualityGate({
          nodeCount: store.nodes.length,
          requiredSections: args.required_sections,
          presentSections: [...presentSections],
          missingComponents: missingComponentIds,
          unresolvedParentLinks,
          repairAttempts: args.repair_attempts ?? 0,
          enterprise: {
            hasDataSection: presentSections.has('main'),
            hasTable,
            hasFilters,
            hasActions,
            hasSidebarContent,
            hasBreadcrumbsContent,
            tableRowCount,
            tableColumnCount,
            minTableRows: requiredRows,
            minTableColumns: requiredColumns,
            domainColumnsPresent,
            jsonStructureMatch
          }
        })
        const minCountCheck = gate.checks.find((check) => check.id === 'min-node-count')
        if (minCountCheck) {
          minCountCheck.passed = store.nodes.length >= minNodeCount
          minCountCheck.detail = `nodeCount=${store.nodes.length} (required >= ${minNodeCount})`
        }
        gate.passed = gate.checks.every((check) => check.passed)
        gate.failReasons = gate.checks.filter((check) => !check.passed).map((check) => check.detail)
        return gate
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    deterministic_assemble: (tool as any)({
      description:
        'Watchdog fallback: deterministically build scaffold and run assembly steps in one call.',
      inputSchema: valibotSchema(deterministicAssembleSchema),
      execute: async (args: {
        sections: string[]
        steps: Array<{
          id: string
          section: string
          component_id: string
          parent_section_id?: string | null
          parent_step_id?: string | null
          slot_name?: string | null
          props?: Record<string, unknown>
        }>
      }) => {
        const scaffold = await (async () => {
          const created: Array<{ section: string; node_id: string }> = []
          const sectionNodeMap: Record<string, string> = {}
          const root = store.addNodeAt('Panel', { parentId: null, index: store.rootNodes.value.length })
          if (!root) return null
          store.updateProps(root.id, { header: '', __scaffoldRoot: true })
          for (const section of args.sections) {
            const node = store.addNodeAt('Panel', {
              parentId: root.id,
              index: store.getChildren(root.id).length
            })
            if (!node) continue
            store.updateProps(node.id, { header: '', __scaffoldSection: section, __section: section })
            sectionNodeMap[section] = node.id
            created.push({ section, node_id: node.id })
          }
          return { rootId: root.id, sectionNodeMap, created }
        })()
        if (!scaffold) return { ok: false, error: 'Failed to create scaffold root' }
        const run = await (async () => {
          const stepNodeMap = new Map<string, string>()
          const failedSteps: string[] = []
          const unresolvedParentLinks: string[] = []
          const executed: Array<{ step_id: string; node_id: string }> = []
          for (const step of args.steps) {
            const parentFromStep =
              step.parent_step_id ? (stepNodeMap.get(step.parent_step_id) ?? null) : null
            const parentFromSection = scaffold.sectionNodeMap[step.parent_section_id ?? step.section] ?? null
            const resolvedParent = parentFromStep ?? parentFromSection
            if (!resolvedParent || !store.canAcceptChildren(resolvedParent)) {
              failedSteps.push(step.id)
              unresolvedParentLinks.push(step.id)
              continue
            }
            const componentId = PRIME_PREVIEW_DEFS.some((def) => def.name === step.component_id)
              ? step.component_id
              : 'Panel'
            const node = store.addNodeAt(componentId, {
              parentId: resolvedParent,
              index: store.getChildren(resolvedParent).length,
              slotName: step.slot_name ?? null
            })
            if (!node) {
              failedSteps.push(step.id)
              continue
            }
            store.updateProps(node.id, {
              ...(step.props ?? {}),
              __section: step.section,
              __stepId: step.id,
              ...(componentId === 'Panel' && componentId !== step.component_id
                ? {
                    __missingComponent: true,
                    __missingReason: `Fallback for ${step.component_id}`,
                    __suggestedComponent: step.component_id
                  }
                : {})
            })
            executed.push({ step_id: step.id, node_id: node.id })
            stepNodeMap.set(step.id, node.id)
          }
          return { failedSteps, unresolvedParentLinks, executed }
        })()
        return {
          ok: run.failedSteps.length === 0,
          root_id: scaffold.rootId,
          section_node_map: scaffold.sectionNodeMap,
          executed: run.executed,
          failed_steps: run.failedSteps,
          unresolved_parent_links: run.unresolvedParentLinks
        }
      }
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
            render_kind: node.renderKind ?? 'runtime',
            parent_id: node.parentId,
            slot_name: node.slotName ?? null
          }
        }
      }
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
          tree: tree.slice(0, Math.max(1, limit))
        }
      }
    }),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- ToolSet compatibility cast
    publish_component_fit: (tool as any)({
      description:
        'Build a structured mapping report for planned blocks: available, missing, and fallback.',
      inputSchema: valibotSchema(componentFitSchema),
      execute: async (args: {
        blocks: Array<{
          id: string
          name: string
          archetype_id?: string | null
          preferred_component?: string | null
        }>
      }) => {
        const availableDefs = PRIME_PREVIEW_DEFS.map((def) => ({
          component_id: def.name,
          archetype_id: def.archetypeId ?? null
        }))
        const availableComponents: Array<{
          block_id: string
          block_name: string
          component_id: string
          archetype_id: string | null
        }> = []
        const missingComponents: Array<{
          block_id: string
          block_name: string
          archetype_id: string | null
          reason: string
        }> = []
        const fallbackPlan: Array<{
          block_id: string
          block_name: string
          from: string
          to_component_id: string
          reason: string
        }> = []

        for (const block of args.blocks) {
          const preferred = block.preferred_component
            ? getPrimeComponentContract(block.preferred_component)
            : null
          const byArchetype = block.archetype_id
            ? PRIME_PREVIEW_DEFS.find((def) => def.archetypeId === block.archetype_id)
            : null
          const resolved = preferred?.def ?? byArchetype ?? null
          if (resolved) {
            availableComponents.push({
              block_id: block.id,
              block_name: block.name,
              component_id: resolved.name,
              archetype_id: resolved.archetypeId ?? null
            })
            continue
          }
          missingComponents.push({
            block_id: block.id,
            block_name: block.name,
            archetype_id: block.archetype_id ?? null,
            reason: 'No runtime component matched preferred/archetype contract'
          })
          fallbackPlan.push({
            block_id: block.id,
            block_name: block.name,
            from: block.preferred_component ?? block.archetype_id ?? block.name,
            to_component_id: 'Panel',
            reason: 'Fallback container keeps structure until dedicated component is available'
          })
        }

        return {
          blocks: args.blocks,
          inventory: availableDefs,
          availableComponents,
          missingComponents,
          fallbackPlan
        }
      }
    })
  }
}
