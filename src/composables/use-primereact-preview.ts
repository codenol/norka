/**
 * Shared PrimeReact preview utilities used by both ComponentPreviewItem
 * (component drawer thumbnails) and ReactPreviewView (full-screen preview).
 */

export interface PrimePreviewDef {
  /** Design component name, e.g. 'Button' */
  name: string
  /** PrimeReact package subpath, e.g. 'primereact/button' */
  importPath: string
  /** Export name within the module, e.g. 'Button' */
  exportName: string
  /** Props passed to createElement for the preview */
  previewProps: Record<string, unknown>
  /** Whether the component can contain children */
  acceptsChildren?: boolean
  /** Supported logical slots for nested components */
  slots?: string[]
  /** Editable props schema for proto properties panel */
  propSchema?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'enum'
    options?: string[]
  }>
  /** Callbacks that should always exist on props */
  requiredCallbacks?: string[]
  /** Safe default props applied before rendering */
  safeDefaults?: Record<string, unknown>
}

export const PRIME_PREVIEW_DEFS: PrimePreviewDef[] = [
  {
    name: 'Button',
    importPath: 'primereact/button',
    exportName: 'Button',
    previewProps: { label: 'Button' },
    propSchema: { label: { type: 'string' } },
  },
  {
    name: 'InputText',
    importPath: 'primereact/inputtext',
    exportName: 'InputText',
    previewProps: { placeholder: 'Enter text...' },
    propSchema: { placeholder: { type: 'string' } },
  },
  {
    name: 'Dropdown',
    importPath: 'primereact/dropdown',
    exportName: 'Dropdown',
    previewProps: { placeholder: 'Select' },
    propSchema: { placeholder: { type: 'string' } },
  },
  { name: 'DataTable', importPath: 'primereact/datatable', exportName: 'DataTable', previewProps: {} },
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
      subTitle: { type: 'string' },
    },
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
      dismissableMask: false,
    },
    propSchema: {
      header: { type: 'string' },
      visible: { type: 'boolean' },
    },
  },
  {
    name: 'Panel',
    importPath: 'primereact/panel',
    exportName: 'Panel',
    acceptsChildren: true,
    slots: ['default'],
    previewProps: { header: 'Panel' },
    propSchema: { header: { type: 'string' } },
  },
  {
    name: 'Tag',
    importPath: 'primereact/tag',
    exportName: 'Tag',
    previewProps: { value: 'Tag' },
    propSchema: { value: { type: 'string' } },
  },
  { name: 'Badge', importPath: 'primereact/badge', exportName: 'Badge', previewProps: { value: '3', severity: 'info' } },
  { name: 'ProgressBar', importPath: 'primereact/progressbar', exportName: 'ProgressBar', previewProps: { value: 50 } },
  {
    name: 'Toolbar',
    importPath: 'primereact/toolbar',
    exportName: 'Toolbar',
    acceptsChildren: true,
    slots: ['start', 'center', 'end', 'default'],
    previewProps: {},
  },
  { name: 'Breadcrumb', importPath: 'primereact/breadcrumb', exportName: 'Breadcrumb', previewProps: { model: [{ label: 'Home' }, { label: 'Page' }] } },
  { name: 'InputNumber', importPath: 'primereact/inputnumber', exportName: 'InputNumber', previewProps: { placeholder: '0' } },
  { name: 'Calendar', importPath: 'primereact/calendar', exportName: 'Calendar', previewProps: { placeholder: 'Pick date' } },
  { name: 'Checkbox', importPath: 'primereact/checkbox', exportName: 'Checkbox', previewProps: { checked: false } },
  { name: 'RadioButton', importPath: 'primereact/radiobutton', exportName: 'RadioButton', previewProps: { checked: false } },
  { name: 'Slider', importPath: 'primereact/slider', exportName: 'Slider', previewProps: { value: 50 } },
  { name: 'TabView', importPath: 'primereact/tabview', exportName: 'TabView', previewProps: {} },
  { name: 'Message', importPath: 'primereact/message', exportName: 'Message', previewProps: { severity: 'info', text: 'Info' } },
  { name: 'Divider', importPath: 'primereact/divider', exportName: 'Divider', previewProps: {} },
]

/** Lookup by design component name → preview def */
export const PRIME_PREVIEW_MAP = new Map<string, PrimePreviewDef>(
  PRIME_PREVIEW_DEFS.map((d) => [d.name, d])
)

export function getPrimePreviewDef(name: string): PrimePreviewDef | null {
  return PRIME_PREVIEW_MAP.get(name) ?? null
}

export function normalizePrimeProps(componentName: string, props: Record<string, unknown>): Record<string, unknown> {
  const def = getPrimePreviewDef(componentName)
  if (!def) return { ...props }
  const next: Record<string, unknown> = {
    ...(def.safeDefaults ?? {}),
    ...props,
  }
  for (const cb of def.requiredCallbacks ?? []) {
    if (typeof next[cb] !== 'function') {
      next[cb] = () => undefined
    }
  }
  return next
}

/** Dynamically import a PrimeReact module by its subpath (first half). */
async function loadPrimeModuleA(path: string): Promise<Record<string, unknown> | null> {
  switch (path) {
    case 'primereact/button':      return import('primereact/button')
    case 'primereact/inputtext':   return import('primereact/inputtext')
    case 'primereact/dropdown':    return import('primereact/dropdown')
    case 'primereact/datatable':   return import('primereact/datatable')
    case 'primereact/card':        return import('primereact/card')
    case 'primereact/dialog':      return import('primereact/dialog')
    case 'primereact/panel':       return import('primereact/panel')
    case 'primereact/tag':         return import('primereact/tag')
    case 'primereact/badge':       return import('primereact/badge')
    case 'primereact/progressbar': return import('primereact/progressbar')
    default:                       return null
  }
}

/** Dynamically import a PrimeReact module by its subpath (second half). */
async function loadPrimeModuleB(path: string): Promise<Record<string, unknown> | null> {
  switch (path) {
    case 'primereact/toolbar':     return import('primereact/toolbar')
    case 'primereact/breadcrumb':  return import('primereact/breadcrumb')
    case 'primereact/inputnumber': return import('primereact/inputnumber')
    case 'primereact/calendar':    return import('primereact/calendar')
    case 'primereact/checkbox':    return import('primereact/checkbox')
    case 'primereact/radiobutton': return import('primereact/radiobutton')
    case 'primereact/slider':      return import('primereact/slider')
    case 'primereact/tabview':     return import('primereact/tabview')
    case 'primereact/message':     return import('primereact/message')
    case 'primereact/divider':     return import('primereact/divider')
    case 'primereact/avatar':      return import('primereact/avatar')
    default:                       return null
  }
}

/** Dynamically import a PrimeReact module by its subpath. */
export async function loadPrimeModule(path: string): Promise<Record<string, unknown> | null> {
  return (await loadPrimeModuleA(path)) ?? loadPrimeModuleB(path)
}
