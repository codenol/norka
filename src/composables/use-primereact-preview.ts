/**
 * Shared PrimeReact preview utilities used by both ComponentPreviewItem
 * (component drawer thumbnails) and ReactPreviewView (full-screen preview).
 */

import {
  BUILT_IN_ARCHETYPES,
  buildAliasMap,
  matchArchetype
} from '@norka/core'

import type { ComponentArchetype } from '@norka/core'

export interface PrimePreviewDef {
  /** Design component name, e.g. 'Button' */
  name: string
  /** PrimeReact package subpath, e.g. 'primereact/button' */
  importPath: string
  /** Export name within the module, e.g. 'Button' */
  exportName: string
  /** Props passed to createElement for the preview */
  previewProps: Record<string, unknown>
  /** Linked semantic archetype id from @norka/core */
  archetypeId?: string
  /** Whether the component can contain children */
  acceptsChildren?: boolean
  /** Supported logical slots for nested components */
  slots?: string[]
  /** Editable props schema for proto properties panel */
  propSchema?: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'enum' | 'json'
      options?: string[]
    }
  >
  /** Callbacks that should always exist on props */
  requiredCallbacks?: string[]
  /** Safe default props applied before rendering */
  safeDefaults?: Record<string, unknown>
  /** Named presets used for stateful dashboard generation */
  statePresets?: Record<string, Record<string, unknown>>
  /** LLM-specific constraints and deterministic fallback */
  llm?: {
    category: 'layout' | 'data' | 'input' | 'navigation' | 'feedback' | 'actions'
    layout: 'leaf' | 'container'
    fallbackComponent: string
    notes?: string[]
  }
}

export const PRIME_PREVIEW_DEFS: PrimePreviewDef[] = [
  {
    name: 'Button',
    importPath: 'primereact/button',
    exportName: 'Button',
    previewProps: { label: 'Button' },
    propSchema: {
      label: { type: 'string' },
      disabled: { type: 'boolean' },
      loading: { type: 'boolean' },
      severity: {
        type: 'enum',
        options: ['secondary', 'success', 'info', 'warn', 'danger', 'help', 'contrast']
      }
    },
    statePresets: {
      default: { disabled: false, loading: false },
      disabled: { disabled: true },
      loading: { loading: true }
    },
    llm: { category: 'actions', layout: 'leaf', fallbackComponent: 'Panel' }
  },
  {
    name: 'InputText',
    importPath: 'primereact/inputtext',
    exportName: 'InputText',
    previewProps: { placeholder: 'Enter text...' },
    propSchema: { placeholder: { type: 'string' } },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'Panel' }
  },
  {
    name: 'Dropdown',
    importPath: 'primereact/dropdown',
    exportName: 'Dropdown',
    previewProps: { placeholder: 'Select' },
    propSchema: {
      placeholder: { type: 'string' },
      disabled: { type: 'boolean' }
    },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'Panel' }
  },
  {
    name: 'DataTable',
    importPath: 'primereact/datatable',
    exportName: 'DataTable',
    previewProps: { paginator: true, rows: 5 },
    propSchema: {
      paginator: { type: 'boolean' },
      rows: { type: 'number' },
      stripedRows: { type: 'boolean' },
      value: { type: 'json' }
    },
    acceptsChildren: true,
    slots: ['default'],
    llm: { category: 'data', layout: 'container', fallbackComponent: 'Panel' }
  },
  {
    name: 'Column',
    importPath: 'primereact/column',
    exportName: 'Column',
    previewProps: { field: 'name', header: 'Name' },
    propSchema: {
      field: { type: 'string' },
      header: { type: 'string' }
    },
    llm: { category: 'data', layout: 'leaf', fallbackComponent: 'Divider' }
  },
  {
    name: 'Card',
    importPath: 'primereact/card',
    exportName: 'Card',
    acceptsChildren: true,
    slots: ['default'],
    previewProps: { title: 'Card Title', subTitle: 'Subtitle' },
    safeDefaults: {},
    propSchema: {
      title: { type: 'string' },
      subTitle: { type: 'string' }
    },
    statePresets: {
      healthy: { subTitle: 'Healthy' },
      warning: { subTitle: 'Warning' },
      critical: { subTitle: 'Critical' }
    },
    llm: { category: 'layout', layout: 'container', fallbackComponent: 'Panel' }
  },
  {
    name: 'Dialog',
    importPath: 'primereact/dialog',
    exportName: 'Dialog',
    acceptsChildren: true,
    slots: ['default'],
    previewProps: { header: 'Dialog', visible: true, draggable: false, onHide: () => undefined },
    requiredCallbacks: ['onHide'],
    safeDefaults: {
      visible: true,
      draggable: false,
      modal: false,
      dismissableMask: false
    },
    propSchema: {
      header: { type: 'string' },
      visible: { type: 'boolean' }
    },
    llm: { category: 'layout', layout: 'container', fallbackComponent: 'Panel' }
  },
  {
    name: 'Panel',
    importPath: 'primereact/panel',
    exportName: 'Panel',
    acceptsChildren: true,
    slots: ['default'],
    previewProps: { header: 'Panel' },
    propSchema: { header: { type: 'string' } },
    llm: { category: 'layout', layout: 'container', fallbackComponent: 'Panel' }
  },
  {
    name: 'Tag',
    importPath: 'primereact/tag',
    exportName: 'Tag',
    previewProps: { value: 'Tag' },
    propSchema: { value: { type: 'string' } },
    llm: { category: 'feedback', layout: 'leaf', fallbackComponent: 'Badge' }
  },
  {
    name: 'Badge',
    importPath: 'primereact/badge',
    exportName: 'Badge',
    previewProps: { value: '3', severity: 'info' },
    propSchema: {
      value: { type: 'string' },
      severity: { type: 'enum', options: ['success', 'info', 'warning', 'danger', 'contrast'] }
    },
    statePresets: {
      healthy: { severity: 'success', value: 'Healthy' },
      warning: { severity: 'warning', value: 'Warning' },
      critical: { severity: 'danger', value: 'Critical' }
    },
    llm: { category: 'feedback', layout: 'leaf', fallbackComponent: 'Tag' }
  },
  {
    name: 'ProgressBar',
    importPath: 'primereact/progressbar',
    exportName: 'ProgressBar',
    previewProps: { value: 50 },
    propSchema: {
      value: { type: 'number' },
      showValue: { type: 'boolean' }
    },
    statePresets: {
      healthy: { value: 90, showValue: true },
      warning: { value: 55, showValue: true },
      critical: { value: 20, showValue: true }
    },
    llm: { category: 'feedback', layout: 'leaf', fallbackComponent: 'Panel' }
  },
  {
    name: 'Toolbar',
    importPath: 'primereact/toolbar',
    exportName: 'Toolbar',
    acceptsChildren: true,
    slots: ['start', 'center', 'end', 'default'],
    previewProps: {},
    llm: { category: 'layout', layout: 'container', fallbackComponent: 'Panel' }
  },
  {
    name: 'Breadcrumb',
    importPath: 'primereact/breadcrumb',
    exportName: 'Breadcrumb',
    previewProps: { model: [{ label: 'Home' }, { label: 'Page' }] },
    llm: { category: 'navigation', layout: 'leaf', fallbackComponent: 'Panel' }
  },
  {
    name: 'InputNumber',
    importPath: 'primereact/inputnumber',
    exportName: 'InputNumber',
    previewProps: { placeholder: '0' },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'InputText' }
  },
  {
    name: 'Calendar',
    importPath: 'primereact/calendar',
    exportName: 'Calendar',
    previewProps: { placeholder: 'Pick date' },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'InputText' }
  },
  {
    name: 'Checkbox',
    importPath: 'primereact/checkbox',
    exportName: 'Checkbox',
    previewProps: { checked: false },
    propSchema: { checked: { type: 'boolean' }, disabled: { type: 'boolean' } },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'InputText' }
  },
  {
    name: 'RadioButton',
    importPath: 'primereact/radiobutton',
    exportName: 'RadioButton',
    previewProps: { checked: false },
    propSchema: { checked: { type: 'boolean' }, disabled: { type: 'boolean' } },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'InputText' }
  },
  {
    name: 'Slider',
    importPath: 'primereact/slider',
    exportName: 'Slider',
    previewProps: { value: 50 },
    propSchema: { value: { type: 'number' }, min: { type: 'number' }, max: { type: 'number' } },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'InputNumber' }
  },
  {
    name: 'TabView',
    importPath: 'primereact/tabview',
    exportName: 'TabView',
    previewProps: {},
    llm: { category: 'navigation', layout: 'container', fallbackComponent: 'Panel' }
  },
  {
    name: 'Message',
    importPath: 'primereact/message',
    exportName: 'Message',
    previewProps: { severity: 'info', text: 'Info' },
    propSchema: {
      severity: { type: 'enum', options: ['success', 'info', 'warn', 'error', 'secondary', 'contrast'] },
      text: { type: 'string' }
    },
    statePresets: {
      healthy: { severity: 'success', text: 'Healthy' },
      warning: { severity: 'warn', text: 'Warning' },
      critical: { severity: 'error', text: 'Critical' }
    },
    llm: { category: 'feedback', layout: 'leaf', fallbackComponent: 'Panel' }
  },
  {
    name: 'Divider',
    importPath: 'primereact/divider',
    exportName: 'Divider',
    previewProps: {},
    llm: { category: 'layout', layout: 'leaf', fallbackComponent: 'Panel' }
  },
  {
    name: 'MultiSelect',
    importPath: 'primereact/multiselect',
    exportName: 'MultiSelect',
    previewProps: { placeholder: 'Select options' },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'Dropdown' }
  },
  {
    name: 'InputTextarea',
    importPath: 'primereact/inputtextarea',
    exportName: 'InputTextarea',
    previewProps: { placeholder: 'Type details...' },
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'InputText' }
  },
  {
    name: 'SelectButton',
    importPath: 'primereact/selectbutton',
    exportName: 'SelectButton',
    previewProps: {},
    llm: { category: 'input', layout: 'leaf', fallbackComponent: 'Dropdown' }
  },
  {
    name: 'Avatar',
    importPath: 'primereact/avatar',
    exportName: 'Avatar',
    previewProps: { label: 'A' },
    llm: { category: 'feedback', layout: 'leaf', fallbackComponent: 'Tag' }
  }
]

const aliasMap = buildAliasMap(BUILT_IN_ARCHETYPES)
const archetypeMap = new Map<string, ComponentArchetype>(
  BUILT_IN_ARCHETYPES.map((a) => [a.id, a])
)

function inferArchetypeId(name: string): string | undefined {
  return matchArchetype(name, aliasMap) ?? undefined
}

function coercePrimePropValue(
  value: unknown,
  schema: { type: 'string' | 'number' | 'boolean' | 'enum' | 'json'; options?: string[] }
): unknown {
  switch (schema.type) {
    case 'string':
      return typeof value === 'string' ? value : String(value)
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
      }
      return null
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') return value === 'true'
      if (typeof value === 'number') return value !== 0
      return false
    case 'enum':
      if (typeof value !== 'string') return schema.options?.[0] ?? null
      if (!schema.options || schema.options.length === 0) return value
      return schema.options.includes(value) ? value : schema.options[0]
    case 'json':
      return value
    default:
      return value
  }
}

export function getPrimeComponentContract(name: string): {
  def: PrimePreviewDef
  archetype: ComponentArchetype | null
} | null {
  const def = getPrimePreviewDef(name)
  if (!def) return null
  const archetypeId = def.archetypeId ?? inferArchetypeId(def.name)
  const archetype = archetypeId ? (archetypeMap.get(archetypeId) ?? null) : null
  return { def: { ...def, archetypeId }, archetype }
}

export function getPrimeStatePresets(componentName: string): Record<string, Record<string, unknown>> {
  return getPrimePreviewDef(componentName)?.statePresets ?? {}
}

export function getPrimeCoverageSnapshot() {
  return {
    total: PRIME_PREVIEW_DEFS.length,
    byCategory: PRIME_PREVIEW_DEFS.reduce<Record<string, number>>((acc, def) => {
      const key = def.llm?.category ?? 'uncategorized'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
    missingContracts: PRIME_PREVIEW_DEFS.filter((def) => !def.llm).map((def) => def.name)
  }
}

const DEMO_SCENE_REQUIREMENTS: Record<string, string[]> = {
  'overview-dashboard': ['Panel', 'Card', 'DataTable', 'Toolbar', 'Button', 'Tag', 'Badge'],
  'table-heavy': ['DataTable', 'Dropdown', 'InputText', 'Button', 'Panel'],
  'form-workflow': ['InputText', 'InputNumber', 'Calendar', 'Dropdown', 'Button', 'Message']
}

export function getPrimeCoverageForDemoScenes() {
  const available = new Set(PRIME_PREVIEW_DEFS.map((def) => def.name))
  return Object.entries(DEMO_SCENE_REQUIREMENTS).map(([sceneId, required]) => {
    const missing = required.filter((component) => !available.has(component))
    return {
      sceneId,
      required,
      missing,
      compatible: missing.length === 0
    }
  })
}

/** Lookup by design component name → preview def */
export const PRIME_PREVIEW_MAP = new Map<string, PrimePreviewDef>(
  PRIME_PREVIEW_DEFS.map((d) => {
    const archetypeId = d.archetypeId ?? inferArchetypeId(d.name)
    return [d.name, { ...d, archetypeId }]
  })
)

export function getPrimePreviewDef(name: string): PrimePreviewDef | null {
  return PRIME_PREVIEW_MAP.get(name) ?? null
}

export function normalizePrimeProps(
  componentName: string,
  props: Record<string, unknown>
): Record<string, unknown> {
  const def = getPrimePreviewDef(componentName)
  if (!def) return { ...props }
  const normalizedProps = sanitizePrimeProps(componentName, props).props
  const next: Record<string, unknown> = {
    ...def.safeDefaults,
    ...normalizedProps
  }
  for (const cb of def.requiredCallbacks ?? []) {
    if (typeof next[cb] !== 'function') {
      next[cb] = () => undefined
    }
  }
  return next
}

export function sanitizePrimeProps(
  componentName: string,
  props: Record<string, unknown>
): { props: Record<string, unknown>; rejected: string[] } {
  const def = getPrimePreviewDef(componentName)
  if (!def?.propSchema) return { props: { ...props }, rejected: [] }
  const next: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [key, value] of Object.entries(props)) {
    if (!Object.hasOwn(def.propSchema, key)) {
      rejected.push(key)
      continue
    }
    const schema = def.propSchema[key]
    const coerced = coercePrimePropValue(value, schema)
    if (coerced === null && schema.type === 'number') {
      rejected.push(key)
      continue
    }
    next[key] = coerced
  }
  return { props: next, rejected }
}

export function applyPrimeStatePreset(
  componentName: string,
  state: string,
  baseProps: Record<string, unknown>
): Record<string, unknown> {
  const def = getPrimePreviewDef(componentName)
  const preset = def?.statePresets?.[state]
  if (!preset) return { ...baseProps }
  return { ...baseProps, ...preset }
}

/** Dynamically import a PrimeReact module by its subpath (first half). */
async function loadPrimeModuleA(path: string): Promise<Record<string, unknown> | null> {
  switch (path) {
    case 'primereact/button':
      return import('primereact/button')
    case 'primereact/inputtext':
      return import('primereact/inputtext')
    case 'primereact/dropdown':
      return import('primereact/dropdown')
    case 'primereact/datatable':
      return import('primereact/datatable')
    case 'primereact/column':
      return import('primereact/column')
    case 'primereact/card':
      return import('primereact/card')
    case 'primereact/dialog':
      return import('primereact/dialog')
    case 'primereact/panel':
      return import('primereact/panel')
    case 'primereact/tag':
      return import('primereact/tag')
    case 'primereact/badge':
      return import('primereact/badge')
    case 'primereact/progressbar':
      return import('primereact/progressbar')
    default:
      return null
  }
}

/** Dynamically import a PrimeReact module by its subpath (second half). */
async function loadPrimeModuleB(path: string): Promise<Record<string, unknown> | null> {
  switch (path) {
    case 'primereact/toolbar':
      return import('primereact/toolbar')
    case 'primereact/breadcrumb':
      return import('primereact/breadcrumb')
    case 'primereact/inputnumber':
      return import('primereact/inputnumber')
    case 'primereact/calendar':
      return import('primereact/calendar')
    case 'primereact/checkbox':
      return import('primereact/checkbox')
    case 'primereact/radiobutton':
      return import('primereact/radiobutton')
    case 'primereact/slider':
      return import('primereact/slider')
    case 'primereact/tabview':
      return import('primereact/tabview')
    case 'primereact/message':
      return import('primereact/message')
    case 'primereact/divider':
      return import('primereact/divider')
    case 'primereact/avatar':
      return import('primereact/avatar')
    case 'primereact/multiselect':
      return import('primereact/multiselect')
    case 'primereact/inputtextarea':
      return import('primereact/inputtextarea')
    case 'primereact/selectbutton':
      return import('primereact/selectbutton')
    default:
      return null
  }
}

/** Dynamically import a PrimeReact module by its subpath. */
export async function loadPrimeModule(path: string): Promise<Record<string, unknown> | null> {
  return (await loadPrimeModuleA(path)) ?? loadPrimeModuleB(path)
}
