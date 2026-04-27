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

import { workspacePath, writeFeatureFile } from '@/composables/use-workspace-fs'
import { useProjects } from '@/composables/use-projects'
import { createTab, getActiveStore } from '@/stores/tabs'
import { createEditorStore } from '@/stores/editor'
import { createAITools } from '@/ai/tools'

import type { EditorStore } from '@/stores/editor'

export interface AnalyticsDesignSources {
  analyticsMd: string
  analyticsSourceMd: string
  implementationReadyMd: string
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
  sources: AnalyticsDesignSources,
): AnalyticsDesignSourceValidation {
  const missing: string[] = []
  if (!sources.analyticsMd.trim()) missing.push('analytics.md')
  if (!sources.analyticsSourceMd.trim()) missing.push('analytics-source.md')
  if (!sources.implementationReadyMd.trim()) missing.push('implementation-ready.md')
  if (missing.length === 0) return { ok: true }

  return {
    ok: false,
    missing,
    message: `Недостаточно данных для генерации дизайна. Заполните: ${missing.join(', ')}`,
  }
}

export function buildAnalyticsDesignPrompt(sources: AnalyticsDesignSources): string {
  return [
    'Собери макет экрана на канвасе на основе текущей аналитики.',
    'Используй ТОЛЬКО данные ниже как source of truth.',
    'Обязательно выполни инструменты в порядке:',
    '1) get_components()',
    '2) render(...) для внешнего контейнера',
    '3) create_instance(...) для компонентов',
    '4) set_layout/batch_update для компоновки',
    '5) describe(...) и исправление критичных проблем',
    '6) save_preview_layout({ screen, frame, nodes })',
    '7) open_design()',
    'После инструментов ответь кратко по-русски: какой экран собран, какие блоки и состояния покрыты.',
    '',
    '# analytics.md',
    sources.analyticsMd,
    '',
    '# analytics-source.md',
    sources.analyticsSourceMd,
    '',
    '# implementation-ready.md',
    sources.implementationReadyMd,
  ].join('\n')
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
        await router.push('/workspace/design')
        return { ok: true, message: 'Opened Design workspace' }
      },
    })

    const savePreviewLayoutTool = makeTool({
      description:
        'Save a structured preview layout for React Preview. ' +
        'Use only components from core runtime manifest and call this before open_design.',
      inputSchema: valibotSchema(v.object({
        screen: v.string(),
        frame: v.optional(v.object({
          width: v.optional(v.number()),
          height: v.optional(v.number()),
        })),
        nodes: v.array(v.object({
          component: v.string(),
          props: v.optional(v.record(v.string(), v.unknown())),
          childrenText: v.optional(v.string()),
        })),
      })),
      execute: async (payload: Record<string, unknown>) => {
        if (!workspacePath.value || !context.value) {
          return { ok: false, error: 'No workspace context for preview-layout.json' }
        }
        const { productId, screenId, featureId } = context.value
        await writeFeatureFile(
          workspacePath.value,
          productId,
          screenId,
          featureId,
          'preview-layout.json',
          JSON.stringify(payload, null, 2),
        )
        return { ok: true, message: 'Saved preview-layout.json' }
      },
    })

    return {
      ...designTools,
      save_preview_layout: savePreviewLayoutTool,
      open_design: openDesignTool,
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

When the user asks for a mockup, wireframe, or screen design:
1. Call \`get_components()\` first to discover PrimeReact component IDs and names
2. Use \`render(...)\` to create the outer frame/container only
3. Use \`create_instance({ component_id, x, y })\` to place PrimeReact instances into the frame
4. Use \`set_layout\` and \`batch_update\` to align, add spacing, and polish the hierarchy
5. Call \`describe({ id })\` on the root frame and fix critical issues from the report
6. Call \`save_preview_layout({ screen, frame, nodes })\` with resolved core component names and props
7. Call \`open_design()\` exactly once to open the Design workspace and show the result
8. Reply with a brief summary: screen name, main components used, frame size

Available PrimeReact components: Button, InputText, Dropdown, DataTable, Card,
Dialog, Panel, Tag, Badge, ProgressBar, Toolbar, Breadcrumb, InputNumber,
Calendar, Checkbox, RadioButton, Slider, TabView, Message, Divider.
`.trim()
