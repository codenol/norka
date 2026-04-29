/**
 * useAnalyticsDesign — provides PrimeReact design tool access to the Analytics
 * workspace AI chat.
 *
 * When the Analytics AI receives a request to build a mockup, it calls these
 * tools to assemble the design in the active (or newly created) editor document,
 * then navigates to /workspace/design to show the result.
 */

import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'
import { useRouter } from 'vue-router'

import { createAITools } from '@/ai/tools'
import {
  buildAssemblyPlanFromScreenPlan,
  buildDeterministicScreenPlan,
  evaluateQualityGate
} from '@/ai/screen-pipeline'
import { useProjects } from '@/composables/use-projects'
import { workspacePath, writeFeatureFile } from '@/composables/use-workspace-fs'
import { createEditorStore } from '@/stores/editor'
import { createTab, getActiveStore } from '@/stores/tabs'
import { buildWorkspacePath } from '@/utils/workspace-route'

import type { EditorStore } from '@/stores/editor'

export interface AnalyticsDesignSources {
  analyticsMd: string
  analyticsSourceMd: string
  mode?: 'auto-scene' | 'code-components'
}

interface AnalyticsGap {
  key: string
  title: string
  reason: string
}

interface AnalyticsDesignSourceValidationOk {
  ok: true
}

interface AnalyticsDesignSourceValidationError {
  ok: false
  missing: string[]
  message: string
}

export type AnalyticsDesignSourceValidation =
  | AnalyticsDesignSourceValidationOk
  | AnalyticsDesignSourceValidationError

export function validateAnalyticsDesignSources(
  sources: AnalyticsDesignSources
): AnalyticsDesignSourceValidation {
  const missing: string[] = []
  if (!sources.analyticsMd.trim()) missing.push('analytics.md')
  if (!sources.analyticsSourceMd.trim()) missing.push('analytics.md')
  if (missing.length === 0) return { ok: true }

  return {
    ok: false,
    missing,
    message: `Недостаточно данных для генерации дизайна. Заполните: ${missing.join(', ')}`
  }
}

export function buildAnalyticsDesignPrompt(sources: AnalyticsDesignSources): string {
  const mode = sources.mode ?? 'auto-scene'
  const unknowns = detectAnalyticsUnknowns(sources.analyticsMd)
  const screenPlan = buildDeterministicScreenPlan(sources.analyticsMd, sources.analyticsSourceMd)
  const assemblyPlan = buildAssemblyPlanFromScreenPlan(screenPlan)
  const compactPlan = JSON.stringify(
    {
      sceneId: screenPlan.sceneId,
      confidence: Number(screenPlan.confidence.toFixed(2)),
      requiredSections: screenPlan.requiredSections.map((section) => section.id),
      requiredBlocks: screenPlan.requiredBlocks.map((block) => ({
        id: block.id,
        sectionId: block.sectionId,
        preferredComponent: block.preferredComponent
      })),
      unknowns: screenPlan.unknowns
    },
    null,
    2
  )
  const compactAssembly = JSON.stringify(
    {
      steps: assemblyPlan.steps
    },
    null,
    2
  )
  const compactBrief = sources.analyticsMd
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900)
  const compactSource = sources.analyticsSourceMd
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 350)
  const unknownBlock =
    unknowns.length === 0
      ? ['- Нет критичных пробелов: можно строить без допущений.']
      : unknowns.map((gap, index) => `- ${index + 1}. [${gap.key}] ${gap.title}: ${gap.reason}`)
  return [
    'Собери макет экрана на канвасе на основе текущей аналитики.',
    `mode: ${mode}`,
    'Работай execution-first: сразу выполняй tool calls и собирай экран из стандартных PrimeReact компонентов.',
    'Не меняй shell/layout workspace и левую панель компонентов. Заполняй только внутренний content-area в центре экрана.',
    'Выбери сцену автоматически на основе аналитики. Если уверенность низкая, выбери fallback scene: overview-dashboard.',
    'Собери экран без остановок и ручных подтверждений.',
    'Используй скрытый pipeline: screen-plan -> assembly-plan -> step-by-step execution.',
    'Используй get_components -> build_layout_scaffold -> run_assembly_steps({ section_node_map, steps }) -> publish_component_fit({ blocks }) -> validate_quality_gate -> describe.',
    'Если прогресс остановился, вызови deterministic_assemble({ sections, steps }) как watchdog fallback.',
    'Любой блок без соответствующего runtime компонента создай как Panel placeholder.',
    'Для placeholder помечай props: __missingComponent=true, __missingReason, __suggestedComponent.',
    'Любой узел, созданный на основе допущения, сразу помечай через mark_assumption({ assumed: true, label }).',
    'После инструментов ответь кратко по-русски: какая сцена выбрана автоматически, что собрано, и что отсутствует.',
    'Если validate_quality_gate возвращает passed=false, выполни repair pass (максимум 2 попытки) и пометь результат как "Черновик неполный".',
    'В конце ответа обязательно отдельным списком: Unknowns и Assumptions, плюс статус pipeline.',
    '',
    '# Compact screen plan (authoritative)',
    compactPlan,
    '',
    '# Compact assembly plan (authoritative)',
    compactAssembly,
    '',
    '# Analytics summary (compact)',
    compactBrief,
    '',
    '# Source digest',
    compactSource,
    '',
    '# Unknowns (detect before build)',
    ...unknownBlock
  ].join('\n')
}

function detectAnalyticsUnknowns(analyticsMd: string): AnalyticsGap[] {
  const source = analyticsMd.toLowerCase()
  const gaps: AnalyticsGap[] = []
  if (!/warning|critical|healthy/.test(source)) {
    gaps.push({
      key: 'states',
      title: 'Состояния не определены',
      reason: 'Нет явного набора healthy/warning/critical.'
    })
  }
  if (/открытые вопросы/.test(source)) {
    gaps.push({
      key: 'open-questions',
      title: 'Открытые вопросы не закрыты',
      reason: 'Есть неопределенности, которые надо подсветить как assumptions.'
    })
  }
  if (!/порог|threshold/.test(source)) {
    gaps.push({
      key: 'thresholds',
      title: 'Пороги статусов не указаны',
      reason: 'Нужно задать временные пороги и явно пометить их как предположения.'
    })
  }
  if (!/действи|cta|action/.test(source)) {
    gaps.push({
      key: 'actions',
      title: 'Не описаны действия пользователя',
      reason: 'Кнопки и сценарии реакции будут предположениями.'
    })
  }
  return gaps
}

/**
 * Returns the currently active EditorStore, or creates a new tab if none exists.
 * This ensures the Analytics AI always has a document to write to.
 */
function ensureEditorStore(): EditorStore {
  try {
    return getActiveStore()
  } catch {
    // No active tab — create a fresh one
    const store = createEditorStore()
    createTab(store)
    store.state.documentName = 'Mockup'
    return store
  }
}

/**
 * Returns the full set of design tools (same as Editor AI) plus a special
 * `open_design` tool that navigates to /workspace/design when the mockup is done.
 *
 * Call this inside `createChat()` when building the ToolLoopAgent for Analytics.
 */
export function useAnalyticsDesign() {
  const router = useRouter()
  const { context } = useProjects()

  function createAnalyticsTools() {
    const store = ensureEditorStore()
    const designTools = createAITools(store)

    // Extra tool: navigate to the Design workspace after mockup assembly
    const makeTool = tool as (...args: unknown[]) => unknown
    const openDesignTool = makeTool({
      description:
        'Open the Design workspace to show the assembled mockup. ' +
        'Call this AFTER you have finished placing all components and the layout is complete.',
      inputSchema: valibotSchema(v.object({})),
      execute: async () => {
        if (!context.value) {
          return { ok: false, error: 'No feature context to open design workspace' }
        }
        await router.push(buildWorkspacePath('design', context.value))
        return { ok: true, message: 'Opened Design workspace' }
      }
    })

    const savePreviewLayoutTool = makeTool({
      description:
        'Save a structured preview layout for React Preview. ' +
        'Use only components from core runtime manifest and call this before open_design.',
      inputSchema: valibotSchema(
        v.object({
          screen: v.string(),
          frame: v.optional(
            v.object({
              width: v.optional(v.number()),
              height: v.optional(v.number())
            })
          ),
          nodes: v.array(
            v.object({
              component: v.string(),
              props: v.optional(v.record(v.string(), v.unknown())),
              childrenText: v.optional(v.string()),
              source: v.optional(v.picklist(['explicit', 'assumed'])),
              assumptionLabel: v.optional(v.string())
            })
          ),
          screenPlan: v.optional(
            v.object({
              sceneId: v.string(),
              confidence: v.number(),
              requiredSections: v.array(v.record(v.string(), v.unknown())),
              requiredBlocks: v.array(v.record(v.string(), v.unknown())),
              unknowns: v.array(v.string()),
              assumptions: v.array(v.string())
            })
          ),
          assemblyPlan: v.optional(
            v.object({
              steps: v.array(v.record(v.string(), v.unknown()))
            })
          ),
          assumptions: v.optional(
            v.array(
              v.object({
                id: v.string(),
                title: v.string(),
                rationale: v.string()
              })
            )
          ),
          unknowns: v.optional(v.array(v.string())),
          qualityGate: v.optional(
            v.object({
              passed: v.boolean(),
              checks: v.array(v.record(v.string(), v.unknown())),
              missingComponents: v.array(v.string()),
              repairAttempts: v.number(),
              finalNodeCount: v.number(),
              failReasons: v.array(v.string())
            })
          ),
          rollout: v.optional(
            v.object({
              phase: v.picklist(['A', 'B', 'C']),
              notes: v.optional(v.string())
            })
          ),
          mode: v.optional(v.picklist(['auto-scene', 'code-components'])),
          componentMapping: v.optional(
            v.object({
              blocks: v.array(v.record(v.string(), v.unknown())),
              availableComponents: v.array(v.record(v.string(), v.unknown())),
              missingComponents: v.array(v.record(v.string(), v.unknown())),
              fallbackPlan: v.array(v.record(v.string(), v.unknown()))
            })
          ),
          flow: v.optional(
            v.object({
              planGenerated: v.boolean(),
              assembled: v.boolean(),
              stage: v.picklist(['planning', 'assembly', 'validation', 'complete', 'failed']),
              status: v.string()
            })
          )
        })
      ),
      execute: async (payload: Record<string, unknown>) => {
        if (!context.value) {
          return { ok: false, error: 'No feature context for preview-layout.json' }
        }
        const root = workspacePath.value ?? 'browser-local'
        const { productId, screenId, featureId } = context.value
        const analyticsMd = typeof payload.analyticsMd === 'string' ? payload.analyticsMd : ''
        const analyticsSourceMd =
          typeof payload.analyticsSourceMd === 'string' ? payload.analyticsSourceMd : ''
        const screenPlan =
          payload.screenPlan ??
          buildDeterministicScreenPlan(analyticsMd, analyticsSourceMd)
        const assemblyPlan = payload.assemblyPlan ?? buildAssemblyPlanFromScreenPlan(screenPlan)
        const fallbackGate = evaluateQualityGate({
          nodeCount: 0,
          requiredSections: (screenPlan as { requiredSections?: Array<{ id?: string }> }).requiredSections
            ?.map((section) => section.id ?? '')
            .filter(Boolean) ?? [],
          presentSections: [],
          missingComponents: [],
          repairAttempts: 0
        })
        const normalizedPayload = {
          ...payload,
          screenPlan,
          assemblyPlan,
          qualityGate: payload.qualityGate ?? fallbackGate,
          flow: {
            planGenerated: true,
            assembled: false,
            stage: 'planning',
            status: 'Сборка'
          }
        }
        await writeFeatureFile(
          root,
          productId,
          screenId,
          featureId,
          'preview-layout.json',
          JSON.stringify(normalizedPayload, null, 2)
        )
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('norka:preview-layout:updated'))
        }
        return { ok: true, message: 'Saved preview-layout.json' }
      }
    })

    return {
      ...designTools,
      save_preview_layout: savePreviewLayoutTool,
      open_design: openDesignTool
    }
  }

  return { createAnalyticsTools, ensureEditorStore }
}

/**
 * System prompt addition for Analytics AI when design tools are available.
 * Prepended to the skill-specific prompt when building a mockup.
 */
export const ANALYTICS_DESIGN_INSTRUCTIONS = `
## Mockup assembly (PrimeReact Core Library)

You are connected to a live design canvas and can mutate it via tools.
Do not stop at textual advice — for mockup requests you MUST execute canvas tools.

When the user asks for a mockup or screen design:
1. Auto-select a scene from analytics context and create internal \`screen-plan\`
2. Build internal \`assembly-plan\` with deterministic step order
3. Call \`build_layout_scaffold(...)\` before content blocks
4. Call \`run_assembly_steps({ section_node_map, steps })\` for sequential execution
5. Call \`publish_component_fit({ blocks })\` and \`validate_quality_gate(...)\`
6. If execution stalls, call \`deterministic_assemble({ sections, steps })\` watchdog fallback
7. If gate fails: run repair pass (max 2 attempts), never report false success
8. Call \`describe(...)\` and reply with selected scene, mapping, and pipeline status

Hybrid assumptions policy (MANDATORY):
- Build immediately, no blocking questionnaire.
- Any guessed value MUST be marked as assumption both in text and on canvas with \`mark_assumption(...)\`.
- Ensure output contains only real components and placeholder nodes for gaps.
- Use standard PrimeReact components as the first choice for generated UI.
- Do not alter workspace shell or component sidebar; fill only the main content area.
`.trim()
