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

import { createTab, getActiveStore } from '@/stores/tabs'
import { createEditorStore } from '@/stores/editor'
import { createAITools } from '@/ai/tools'

import type { EditorStore } from '@/stores/editor'

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

  function createAnalyticsTools() {
    const store = ensureEditorStore()
    const designTools = createAITools(store)

    // Extra tool: navigate to the Design workspace after mockup assembly
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- same pattern as createAITools save_component_rules
    const openDesignTool = (tool as (...a: any[]) => unknown)({
      description:
        'Open the Design workspace to show the assembled mockup. ' +
        'Call this AFTER you have finished placing all components and the layout is complete.',
      inputSchema: valibotSchema(v.object({})),
      execute: async () => {
        await router.push('/workspace/design')
        return { ok: true, message: 'Opened Design workspace' }
      },
    })

    return {
      ...designTools,
      // eslint-disable-next-line typescript-eslint/no-explicit-any
      open_design: openDesignTool as any,
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

When the user asks for a mockup, wireframe, or screen design:
1. Call \`get_components()\` to discover PrimeReact component IDs
2. Use \`render(...)\` for the outer frame skeleton
3. Use \`create_instance({ component_id, x, y })\` to place components inside
4. Use \`batch_update\` to align and space components
5. Call \`open_design()\` to open the Design workspace and show the result
6. Reply with a brief summary: screen name, main components used, frame size

Available PrimeReact components: Button, InputText, Dropdown, DataTable, Card,
Dialog, Panel, Tag, Badge, ProgressBar, Toolbar, Breadcrumb, InputNumber,
Calendar, Checkbox, RadioButton, Slider, TabView, Message, Divider.
`.trim()
