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
  buildAssemblyPlanFromEnterprisePlan,
  buildEnterpriseScreenPlan,
  enterprisePlanToScreenPlan,
  evaluateQualityGate,
  normalizeRenderPlan,
  RENDER_CONTRACT_VERSION,
  repairEnterpriseScreenPlan
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

export const GENOM_GOLDEN_REFERENCE = {
  name: 'genom-firmware-report-light',
  theme: 'light',
  images: [
    '/Users/a1111/.cursor/projects/Users-a1111-Documents-code-openpencil/assets/image-04094921-0d29-412c-a164-3c31e75167fb.png',
    '/Users/a1111/.cursor/projects/Users-a1111-Documents-code-openpencil/assets/image-3f1c6737-52e3-4213-b1a8-c4d4c1b2f4de.png',
    '/Users/a1111/.cursor/projects/Users-a1111-Documents-code-openpencil/assets/image-aab7b989-49cc-4a07-81b7-01fa7ed708ad.png',
    '/Users/a1111/.cursor/projects/Users-a1111-Documents-code-openpencil/assets/image-120f9fa4-1b69-4ded-8149-2137c0a509bd.png',
    '/Users/a1111/.cursor/projects/Users-a1111-Documents-code-openpencil/assets/image-3881efae-9e50-4082-9898-2bd29e140f68.png'
  ],
  checklist: [
    'mini-sidebar + sidebar navigation are present',
    'breadcrumbs row is present and populated',
    'filters row and toolbar actions are present',
    'firmware report table has enterprise density'
  ]
} as const

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
  const templatePlan = buildEnterpriseScreenPlan('', '')
  const compactEnterprisePlan = JSON.stringify(templatePlan, null, 2)
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
  const isGenomFirmware = /геном|прошив/i.test(`${sources.analyticsMd}\n${sources.analyticsSourceMd}`)
  const goldenReference = isGenomFirmware ? GENOM_GOLDEN_REFERENCE : null
  return [
    'Сформируй JSON-план экрана уровня Enterprise SaaS на основе текущей аналитики.',
    `mode: ${mode}`,
    'Фаза PLAN: не выполняй мутации канваса и не вызывай create_instance/move_node/run_assembly_steps.',
    'Верни только JSON-план enterprise-screen-plan.v1 (без markdown, без пояснений).',
    'В плане обязательно укажи sections, blocks, dataSchema, tableSpec, interactions и quality.',
    'Не меняй shell/layout workspace; план должен заполнять существующие зоны sidebar/breadcrumbs/header/main/actions.',
    'Если данных не хватает, заполни unknowns и assumptions, но не пропускай обязательные секции.',
    'Раздел «Важные замечания» из analytics.md обязателен к исполнению: трактуй его как набор жёстких инвариантов JSON-контракта и рендера.',
    'JSON-план — единственный источник истины для сборки. Не рассчитывай на fallback-контент из кода.',
    'Обязательно заполни sections[].items и blocks[].component/props для sidebar, breadcrumbs и main.',
    ...(goldenReference
      ? [
          'Для этого экрана используй golden-reference как эталон структуры в светлой теме; в тёмной теме адаптируй палитру автоматически.',
          `Golden checklist: ${goldenReference.checklist.join('; ')}`
        ]
      : []),
    '',
    '# Enterprise screen plan template (authoritative)',
    compactEnterprisePlan,
    '',
    '# Analytics summary (compact)',
    compactBrief,
    '',
    '# Source digest',
    compactSource,
    ...(goldenReference
      ? ['', '# Golden reference (authoritative)', JSON.stringify(goldenReference, null, 2)]
      : []),
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
          enterpriseScreenPlan: v.optional(v.record(v.string(), v.unknown())),
          planVersions: v.optional(v.array(v.record(v.string(), v.unknown()))),
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
          ),
          goldenReference: v.optional(v.record(v.string(), v.unknown()))
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
        const enterpriseScreenPlan =
          payload.enterpriseScreenPlan && typeof payload.enterpriseScreenPlan === 'object'
            ? payload.enterpriseScreenPlan
            : null
        if (!enterpriseScreenPlan) {
          return {
            ok: false,
            error: 'enterpriseScreenPlan is required in JSON-only mode'
          }
        }
        const screenPlan = payload.screenPlan ?? enterprisePlanToScreenPlan(enterpriseScreenPlan)
        const incomingAssemblyPlan =
          payload.assemblyPlan ?? buildAssemblyPlanFromEnterprisePlan(enterpriseScreenPlan)
        const normalizedAssemblyPlan =
          Array.isArray(incomingAssemblyPlan?.steps) && incomingAssemblyPlan.steps.length > 0
            ? incomingAssemblyPlan
            : buildAssemblyPlanFromEnterprisePlan(enterpriseScreenPlan)
        const usedFallbackAssembly = normalizedAssemblyPlan !== incomingAssemblyPlan
        const fallbackGate = evaluateQualityGate({
          nodeCount: 0,
          requiredSections: (screenPlan as { requiredSections?: Array<{ id?: string }> }).requiredSections
            ?.map((section) => section.id ?? '')
            .filter(Boolean) ?? [],
          presentSections: [],
          missingComponents: [],
          repairAttempts: 0
        })
        const incomingPlanVersions = Array.isArray(payload.planVersions) ? payload.planVersions : []
        const incomingQualityGate = payload.qualityGate ?? fallbackGate
        const shouldRepair =
          incomingQualityGate.passed === false &&
          (incomingQualityGate.repairAttempts ?? 0) < 2 &&
          Array.isArray(incomingQualityGate.failReasons)
        const repairedEnterprisePlan = shouldRepair
          ? repairEnterpriseScreenPlan(enterpriseScreenPlan, incomingQualityGate.failReasons ?? [])
          : null
        const finalEnterprisePlan = repairedEnterprisePlan ?? enterpriseScreenPlan
        const finalScreenPlan = repairedEnterprisePlan
          ? enterprisePlanToScreenPlan(repairedEnterprisePlan)
          : screenPlan
        const finalAssemblyPlan = repairedEnterprisePlan
          ? buildAssemblyPlanFromEnterprisePlan(repairedEnterprisePlan)
          : normalizedAssemblyPlan
        const normalizedPayload = {
          ...payload,
          contractVersion: RENDER_CONTRACT_VERSION,
          enterpriseScreenPlan: finalEnterprisePlan,
          screenPlan: finalScreenPlan,
          assemblyPlan: finalAssemblyPlan,
          planVersions: [
            ...incomingPlanVersions,
            {
              version: incomingPlanVersions.length + 1,
              createdAt: Date.now(),
              stage: shouldRepair ? 'validation' : 'planning',
              plan: finalEnterprisePlan,
              reason: shouldRepair ? 'repair-pass' : 'initial'
            }
          ],
          qualityGate: incomingQualityGate,
          flow: {
            planGenerated: true,
            assembled: false,
            stage: shouldRepair ? 'validation' : 'planning',
            status: shouldRepair
              ? 'Repair pass подготовлен'
              : usedFallbackAssembly
                ? 'fallback-assembly'
                : 'Сборка'
          },
          goldenReference:
            payload.goldenReference ??
            (/геном|прошив/i.test(`${analyticsMd}\n${analyticsSourceMd}`) ? GENOM_GOLDEN_REFERENCE : null)
        }
        const contractCheck = normalizeRenderPlan(normalizedPayload)
        if (!contractCheck.ok) {
          return {
            ok: false,
            error: `invalid-contract: ${contractCheck.diagnostics.join('; ')}`
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
## Mockup assembly (Design System + PrimeReact)

Return only JSON payload that matches the render contract.
Do not return markdown explanations.

When the user asks for a mockup or screen design:
1. Produce \`enterpriseScreenPlan\` with version \`enterprise-screen-plan.v1\`
2. Provide \`assemblyPlan.steps\` using component_id/section/parent_step_id/slot_name/props
3. Fill sidebar, breadcrumbs, header/main/actions according to analytics
4. Ensure table-heavy screens include DataTable + Column steps
5. Include \`flow.status\` describing plan quality (\`ready\`, \`partial\`, or \`invalid-contract\`)

Hybrid assumptions policy (MANDATORY):
- Build immediately, no blocking questionnaire.
- Any guessed value MUST be marked in \`assumptions[]\`.
- Ensure output contains only real components and explicit diagnostics for gaps.
- Prefer local design-system component_id values when applicable:
  - DesignSystemBreadcrumb
  - DesignSystemSidebarPanel
  - DesignSystemDataTable
  - DesignSystemStatusBadge
- If no design-system component fits, use standard PrimeReact components.
- Do not alter workspace shell or component sidebar; fill only the main content area.
`.trim()
