import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { makeFigmaFromStore } from '@/automation/figma-factory'
import { useCodeConnectStore } from '@/stores/code-connect'
import { getActiveEditorStore } from '@/stores/editor'
import {
  CORE_TOOLS,
  collectFontKeys,
  computeAllLayouts,
  isFontLoaded,
  loadFont,
  toolsToAI
} from '@norka/core'

import type { EditorStore } from '@/stores/editor'
import type { SceneNode, StepBudget, ToolLogEntry } from '@norka/core'

export const MAX_AGENT_STEPS = 50

export interface StepUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  timestamp: number
}

class RunState {
  toolLog: ToolLogEntry[] = []
  stepUsages: StepUsage[] = []
  currentSteps = 0

  recordStep(usage: StepUsage): void {
    this.stepUsages.push(usage)
    this.currentSteps++
  }

  resetSteps(): void {
    this.currentSteps = 0
  }

  hitLimit(): boolean {
    return this.currentSteps >= MAX_AGENT_STEPS
  }

  clear(): void {
    this.toolLog = []
    this.stepUsages = []
    this.currentSteps = 0
  }
}

const runStates = new WeakMap<EditorStore, RunState>()

function getRunState(store?: EditorStore): RunState {
  const target = store ?? getActiveEditorStore()
  const existing = runStates.get(target)
  if (existing) return existing
  const created = new RunState()
  runStates.set(target, created)
  return created
}

export function getToolLogEntries(store?: EditorStore): ToolLogEntry[] {
  return getRunState(store).toolLog
}

export function getStepUsages(store?: EditorStore): StepUsage[] {
  return getRunState(store).stepUsages
}

export function recordStepUsage(usage: StepUsage, store?: EditorStore): void {
  getRunState(store).recordStep(usage)
}

export function resetRunSteps(store?: EditorStore): void {
  getRunState(store).resetSteps()
}

export function didHitStepLimit(store?: EditorStore): boolean {
  return getRunState(store).hitLimit()
}

export function clearToolLogEntries(store?: EditorStore): void {
  getRunState(store).clear()
}

// ---------------------------------------------------------------------------
// save_component_rules — AI writes usage rules for a library component
// ---------------------------------------------------------------------------

function makeSaveComponentRulesTool() {
  const codeConnect = useCodeConnectStore()

  const schema = v.object({
    component_node_id: v.string('The COMPONENT node ID from the library graph'),
    usage: v.string('Short description of when and why to use this component'),
    constraints: v.optional(v.array(v.string())),
    examples: v.optional(v.array(v.string())),
    anti_patterns: v.optional(v.array(v.string()))
  })

  return (tool as (...args: unknown[]) => unknown)({
    description:
      'Save usage rules for a design library component. Call this after the user confirms the rules you proposed for a component.',
    inputSchema: valibotSchema(schema as unknown as Parameters<typeof valibotSchema>[0]),
    execute: async (args: Record<string, unknown>) => {
      const component_node_id = args.component_node_id as string
      const usage = args.usage as string
      const constraints = args.constraints as string[] | undefined
      const examples = args.examples as string[] | undefined
      const anti_patterns = args.anti_patterns as string[] | undefined

      const existing = codeConnect.getEntry(component_node_id)
      if (!existing) {
        return { ok: false, error: `No Code Connect entry found for node ID: ${component_node_id}` }
      }
      const rule = {
        usage,
        constraints: constraints ?? [],
        examples: examples ?? [],
        antiPatterns: anti_patterns ?? [],
        updatedAt: new Date().toISOString(),
        updatedBy: 'ai' as const
      }
      codeConnect.upsertEntry({ ...existing, rules: rule })
      return { ok: true, message: `Rules saved for component "${existing.designName}"` }
    }
  })
}

export function createAITools(store: EditorStore) {
  let beforeSnapshot: Map<string, SceneNode> | null = null
  const runState = getRunState(store)

  const saveComponentRules = makeSaveComponentRulesTool()

  return {
    ...toolsToAI(
      CORE_TOOLS,
      {
        getFigma: () => makeFigmaFromStore(store),
        onBeforeExecute: (def) => {
          if (def.mutates) {
            beforeSnapshot = store.snapshotPage()
          }
        },
        onAfterExecute: async (def) => {
          if (def.mutates) {
            const pageId = store.state.currentPageId
            const pageNode = store.graph.getNode(pageId)
            if (pageNode) {
              const fontKeys = collectFontKeys(store.graph, pageNode.childIds)
              const missing = fontKeys.filter(([family]) => !isFontLoaded(family))
              if (missing.length > 0) {
                const results = await Promise.all(
                  missing.map(([family, style]) => loadFont(family, style))
                )
                if (results.some((r) => r !== null)) {
                  for (const [, node] of store.graph.nodes) {
                    if (node.type === 'TEXT' && node.textPicture) node.textPicture = null
                  }
                }
              }
            }
            computeAllLayouts(store.graph, pageId)
            store.requestRender()
            if (beforeSnapshot) {
              const before = beforeSnapshot
              const after = store.snapshotPage()
              store.pushUndoEntry({
                label: `AI: ${def.name}`,
                forward: () => store.restorePageFromSnapshot(after),
                inverse: () => store.restorePageFromSnapshot(before)
              })
              beforeSnapshot = null
            }
          }
        },
        onFlashNodes: (nodeIds) => {
          store.renderer?.aiClearActive()
          if (nodeIds.length > 0) {
            store.aiFlashDone(nodeIds)
          }
        },
        onToolLog: (entry) => {
          runState.toolLog.push(entry)
        },
        getStepBudget: (): StepBudget => ({
          current: runState.currentSteps,
          max: MAX_AGENT_STEPS
        })
      },
      { v, valibotSchema, tool }
    ),
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- unknown cast required to satisfy ToolSet's CoreTool constraint
    save_component_rules: saveComponentRules as any
  }
}

export type AITools = ReturnType<typeof createAITools>
