export type PipelineStage = 'planning' | 'assembly' | 'validation' | 'complete' | 'failed'

export type EnterpriseScreenKind =
  | 'dashboard'
  | 'list'
  | 'detail'
  | 'settings'
  | 'workflow'
  | 'approvals'

export type EnterpriseSectionKind =
  | 'navigation'
  | 'data'
  | 'status'
  | 'filters'
  | 'actions'
  | 'header'
  | 'form'

export type EnterpriseBlockKind =
  | 'summaryPanel'
  | 'breadcrumbTrail'
  | 'pageHeader'
  | 'filtersBar'
  | 'kpiRow'
  | 'kpiCard'
  | 'entityTable'
  | 'bulkActions'
  | 'primaryActions'

export interface ScreenPlanSection {
  id: string
  title: string
  required: boolean
}

export interface ScreenPlanBlock {
  id: string
  sectionId: string
  name: string
  archetypeId: string | null
  preferredComponent: string | null
}

export interface ScreenPlan {
  sceneId: string
  confidence: number
  requiredSections: ScreenPlanSection[]
  requiredBlocks: ScreenPlanBlock[]
  unknowns: string[]
  assumptions: string[]
}

export interface EnterpriseSection {
  id: string
  title: string
  required: boolean
  kind: EnterpriseSectionKind
  items?: Array<{
    id: string
    component: string
    title?: string
    props?: Record<string, unknown>
  }>
}

export interface EnterpriseBlock {
  id: string
  sectionId: string
  kind: EnterpriseBlockKind
  title: string
  component?: string
  props?: Record<string, unknown>
}

export interface EnterpriseTableSpec {
  rowCountTarget?: number
  density?: 'compact' | 'comfortable'
  columns?: Array<{ key: string; label: string }>
  sampleRows?: Array<Record<string, unknown>>
}

export interface EnterpriseDataField {
  key: string
  label: string
  type: 'string' | 'number' | 'status' | 'date'
}

export interface EnterpriseScreenPlanV1 {
  version: 'enterprise-screen-plan.v1'
  screenMeta: {
    kind: EnterpriseScreenKind
    sceneId: string
    confidence: number
  }
  layout: {
    requiredSections: string[]
  }
  sections: EnterpriseSection[]
  blocks: EnterpriseBlock[]
  dataSchema: {
    entityName: string
    fields: EnterpriseDataField[]
  }
  tableSpec?: EnterpriseTableSpec
  interactions: string[]
  quality: {
    mustHaveTable: boolean
    mustHaveFilters: boolean
    mustHaveActions: boolean
    mustFillSidebar: boolean
    mustFillBreadcrumbs: boolean
  }
  unknowns: string[]
  assumptions: string[]
}

export interface AssemblyStep {
  id: string
  section: string
  intent: string
  component_id: string
  parent_section_id?: string
  parent_step_id?: string
  slot_name?: string
  props?: Record<string, unknown>
  expectedChecks: string[]
}

export interface AssemblyPlan {
  steps: AssemblyStep[]
}

export const RENDER_CONTRACT_VERSION = 'render-contract.v1'

export interface RenderContractPayload {
  contractVersion?: string
  enterpriseScreenPlan?: unknown
  assemblyPlan?: { steps?: Array<Record<string, unknown>> }
  flow?: { status?: string; diagnostics?: string[] }
}

export interface RenderTreeNode {
  id: string
  section: string
  component_id: string
  props: Record<string, unknown>
  slot_name?: string
  parent_step_id?: string
  children: RenderTreeNode[]
}

export interface RenderTree {
  sidebar: RenderTreeNode[]
  breadcrumbs: RenderTreeNode[]
  main: RenderTreeNode[]
  actions: RenderTreeNode[]
  diagnostics: string[]
}

export type NormalizeRenderPlanResult =
  | {
      ok: true
      contractVersion: string
      enterpriseScreenPlan: EnterpriseScreenPlanV1
      assemblyPlan: AssemblyPlan
      diagnostics: string[]
    }
  | {
      ok: false
      contractVersion: string
      diagnostics: string[]
    }

export interface QualityGateResult {
  passed: boolean
  checks: Array<{ id: string; passed: boolean; detail: string }>
  missingComponents: string[]
  repairAttempts: number
  finalNodeCount: number
  failReasons: string[]
}

export interface EnterpriseQualitySignals {
  hasDataSection?: boolean
  hasTable?: boolean
  hasFilters?: boolean
  hasActions?: boolean
  hasSidebarContent?: boolean
  hasBreadcrumbsContent?: boolean
  tableRowCount?: number
  tableColumnCount?: number
  minTableRows?: number
  minTableColumns?: number
  domainColumnsPresent?: boolean
  jsonStructureMatch?: boolean
}

export const DESIGN_SYSTEM_COMPONENT_IDS = [
  'DesignSystemBreadcrumb',
  'DesignSystemDataTable',
  'DesignSystemSidebarPanel',
  'DesignSystemStatusBadge'
] as const

export function normalizeComponentName(name: string): string {
  const normalized = name.trim()
  const lowered = normalized.toLowerCase()
  if (lowered === 'breadcrum' || lowered === 'breadcrumb' || lowered === 'bread-crumb') return 'DesignSystemBreadcrumb'
  if (name === 'BreadCrumbs' || name === 'CustomBreadCrumb') return 'DesignSystemBreadcrumb'
  if (name === 'DataTableDynamic') return 'DesignSystemDataTable'
  if (name === 'StatusBadge') return 'DesignSystemStatusBadge'
  if (lowered === 'page_header' || lowered === 'page-header' || lowered === 'pageheader') {
    return 'DesignSystemPageHeader'
  }
  return normalized
}

function normalizeAssemblySteps(raw: Array<Record<string, unknown>>): AssemblyStep[] {
  return raw
    .map((step) => {
      const id = typeof step.id === 'string' ? step.id : ''
      const section =
        typeof step.section === 'string'
          ? step.section
          : typeof step.sectionId === 'string'
            ? step.sectionId
            : ''
      const component_id =
        typeof step.component_id === 'string'
          ? step.component_id
          : typeof step.componentId === 'string'
            ? step.componentId
            : typeof step.component === 'string'
              ? step.component
              : ''
      const normalizedComponentId = normalizeComponentName(component_id)
      const parent_step_id =
        typeof step.parent_step_id === 'string'
          ? step.parent_step_id
          : typeof step.parentStepId === 'string'
            ? step.parentStepId
            : undefined
      const slot_name =
        typeof step.slot_name === 'string'
          ? step.slot_name
          : typeof step.slotName === 'string'
            ? step.slotName
            : undefined
      const props = step.props && typeof step.props === 'object' ? (step.props as Record<string, unknown>) : {}
      if (!id || !section || !normalizedComponentId) return null
      return {
        id,
        section,
        intent: typeof step.intent === 'string' ? step.intent : `Render ${id}`,
        component_id: normalizedComponentId,
        parent_step_id,
        slot_name,
        props,
        expectedChecks: []
      } satisfies AssemblyStep
    })
    .filter((step): step is AssemblyStep => step !== null)
}

export function normalizeRenderPlan(input: unknown): NormalizeRenderPlanResult {
  const payload = (input && typeof input === 'object' ? input : {}) as RenderContractPayload
  const errors: string[] = []
  const diagnostics: string[] = []
  const contractVersion =
    typeof payload.contractVersion === 'string' ? payload.contractVersion : RENDER_CONTRACT_VERSION
  const enterprise = payload.enterpriseScreenPlan
  if (!enterprise || typeof enterprise !== 'object') {
    return {
      ok: false,
      contractVersion,
      diagnostics: ['enterpriseScreenPlan is required']
    }
  }
  const plan = structuredClone(enterprise) as EnterpriseScreenPlanV1
  if (plan.version !== 'enterprise-screen-plan.v1') {
    errors.push('enterpriseScreenPlan.version must be enterprise-screen-plan.v1')
  }
  if (!Array.isArray(plan.layout?.requiredSections) || plan.layout.requiredSections.length === 0) {
    errors.push('layout.requiredSections must be non-empty')
  }
  if (!Array.isArray(plan.sections) || plan.sections.length === 0) errors.push('sections[] is required')
  if (!Array.isArray(plan.blocks) || plan.blocks.length === 0) errors.push('blocks[] is required')
  if (!plan.quality) errors.push('quality is required')
  if (errors.length > 0) return { ok: false, contractVersion, diagnostics: errors }
  const requiredByPolicy = ['sidebar', 'breadcrumbs', 'main']
  const requiredSet = new Set(
    Array.isArray(plan.layout?.requiredSections) ? plan.layout.requiredSections.filter(Boolean) : []
  )
  const ensureRequiredSection = (sectionId: string, title: string, kind: EnterpriseSectionKind) => {
    if (!plan.sections.some((section) => section.id === sectionId)) {
      plan.sections.push({ id: sectionId, title, required: true, kind, items: [] })
      diagnostics.push(`section synthesized: ${sectionId}`)
    }
    if (!requiredSet.has(sectionId)) {
      requiredSet.add(sectionId)
      diagnostics.push(`required section normalized: ${sectionId}`)
    }
  }
  ensureRequiredSection('sidebar', 'Sidebar', 'navigation')
  ensureRequiredSection('breadcrumbs', 'Breadcrumbs', 'navigation')
  ensureRequiredSection('main', 'Main', 'data')
  plan.layout.requiredSections = Array.from(requiredSet)
  const hasSectionContent = (sectionId: string) =>
    plan.blocks.some((block) => block.sectionId === sectionId) ||
    plan.sections.some((section) => section.id === sectionId && (section.items?.length ?? 0) > 0)
  if (!hasSectionContent('sidebar')) {
    plan.blocks.push({
      id: 'contract-sidebar-card',
      sectionId: 'sidebar',
      kind: 'summaryPanel',
      title: 'Navigation',
      component: 'DesignSystemSidebarPanel',
      props: {
        title: 'Navigation',
        activeId: 'overview',
        items: [
          { id: 'overview', label: 'Overview', icon: 'circle', selected: true },
          { id: 'report', label: 'Report', icon: 'layout-grid', selected: false }
        ]
      }
    })
    diagnostics.push('sidebar content synthesized')
  }
  if (!hasSectionContent('breadcrumbs')) {
    plan.blocks.push({
      id: 'contract-breadcrumbs',
      sectionId: 'breadcrumbs',
      kind: 'breadcrumbTrail',
      title: 'Home / Screen',
      component: 'DesignSystemBreadcrumb',
      props: { model: [{ label: 'Home' }, { label: 'Screen' }] }
    })
    diagnostics.push('breadcrumbs content synthesized')
  }
  if (!hasSectionContent('main')) {
    plan.blocks.push({
      id: 'contract-main-table',
      sectionId: 'main',
      kind: 'entityTable',
      title: 'Data Table',
      component: 'DesignSystemDataTable',
      props: { paginator: true, rows: 10, stripedRows: true }
    })
    diagnostics.push('main content synthesized')
  }
  const incomingSteps = Array.isArray(payload.assemblyPlan?.steps) ? payload.assemblyPlan.steps : []
  const normalizedIncoming = normalizeAssemblySteps(incomingSteps)
  const incomingSections = new Set(normalizedIncoming.map((step) => step.section))
  const incomingHasMain = incomingSections.has('main') || incomingSections.has('header') || incomingSections.has('actions')
  const useIncoming = normalizedIncoming.length > 0 && incomingHasMain
  const assemblyPlan = useIncoming ? { steps: normalizedIncoming } : buildAssemblyPlanFromEnterprisePlan(plan)
  if (!useIncoming) {
    diagnostics.push(
      normalizedIncoming.length === 0
        ? 'assemblyPlan.steps empty; generated deterministically'
        : 'assemblyPlan missing main zones; regenerated from enterpriseScreenPlan'
    )
  }
  return {
    ok: true,
    contractVersion,
    enterpriseScreenPlan: plan,
    assemblyPlan,
    diagnostics
  }
}

export function buildRenderTree(plan: EnterpriseScreenPlanV1, assemblyPlan: AssemblyPlan): RenderTree {
  const diagnostics: string[] = []
  const byId = new Map<string, RenderTreeNode>()
  const nodes: RenderTreeNode[] = []
  for (const step of assemblyPlan.steps) {
    const node: RenderTreeNode = {
      id: step.id,
      section: step.section,
      component_id: step.component_id,
      props: step.props ?? {},
      slot_name: step.slot_name,
      parent_step_id: step.parent_step_id,
      children: []
    }
    nodes.push(node)
    byId.set(node.id, node)
  }
  const roots: RenderTreeNode[] = []
  for (const node of nodes) {
    const parentId = node.parent_step_id
    if (!parentId) {
      roots.push(node)
      continue
    }
    const parent = byId.get(parentId)
    if (!parent) {
      diagnostics.push(`Unresolved parent: ${node.id} -> ${parentId}`)
      roots.push(node)
      continue
    }
    if (parent.section !== node.section) {
      diagnostics.push(`Cross-section parent recovered: ${node.id} -> ${parentId}`)
      roots.push(node)
      continue
    }
    parent.children.push(node)
  }
  const zoned = {
    sidebar: roots.filter((node) => node.section === 'sidebar'),
    breadcrumbs: roots.filter((node) => node.section === 'breadcrumbs'),
    main: roots.filter((node) => node.section !== 'sidebar' && node.section !== 'breadcrumbs' && node.section !== 'actions'),
    actions: roots.filter((node) => node.section === 'actions')
  }
  const missingRequired = ['sidebar', 'breadcrumbs', 'main'].filter((zone) => zoned[zone as keyof typeof zoned].length === 0)
  for (const zone of missingRequired) diagnostics.push(`Zone has no root nodes: ${zone}`)
  if (zoned.main.length === 0 && zoned.actions.length > 0) {
    zoned.main = [...zoned.actions]
  }
  return { ...zoned, diagnostics }
}

export function buildDeterministicScreenPlan(brief: string, source: string): ScreenPlan {
  const enterprise = buildEnterpriseScreenPlan(brief, source)
  return enterprisePlanToScreenPlan(enterprise)
}

type SidebarMenuRule = {
  items: Array<{ id: string; label: string; icon: string; selected: boolean }>
  activeId: string
}

function extractMarkdownSection(md: string, title: string): string {
  const match = md.match(new RegExp(`## ${title}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`))
  return match?.[1]?.trim() ?? ''
}

function normalizeComparableLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSidebarRuleFromImportantNotes(brief: string): SidebarMenuRule | null {
  const notes = extractMarkdownSection(brief, 'Важные замечания')
  if (!notes) return null
  const menuChunk = notes.match(/Внутри меню должны быть пункты:\s*([\s\S]*?)(?:\n{2,}|$)/i)?.[1] ?? ''
  const menuLabels = menuChunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
  if (menuLabels.length === 0) return null
  const selectedLabelRaw = notes.match(/Выбран пункт\s+[«"]([^"\n»]+)[»"]?/i)?.[1]?.trim() ?? ''
  const selectedLabel = normalizeComparableLabel(selectedLabelRaw)
  const items = menuLabels.map((label, index) => {
    const isSelected =
      selectedLabel.length > 0 && normalizeComparableLabel(label) === selectedLabel
    return {
      id: `menu-item-${index + 1}`,
      label,
      icon: index % 2 === 0 ? 'circle' : 'layout-grid',
      selected: isSelected
    }
  })
  const selectedItem = items.find((item) => item.selected) ?? items[0]
  if (!selectedItem) return null
  if (!items.some((item) => item.selected)) {
    selectedItem.selected = true
  }
  return {
    items,
    activeId: selectedItem.id
  }
}

export function buildEnterpriseScreenPlan(brief: string, source: string): EnterpriseScreenPlanV1 {
  const content = `${brief}\n${source}`.trim()
  const confidence = content.length > 0 ? 0.7 : 0.55
  const isGenomFirmware = /геном|genom/i.test(content) && /прошив|firmware/i.test(content)
  const sidebarRule = buildSidebarRuleFromImportantNotes(brief)
  if (isGenomFirmware) {
    const sections: EnterpriseSection[] = [
      {
        id: 'sidebar',
        title: 'Sidebar',
        required: true,
        kind: 'navigation',
        items: [
          {
            id: 'sidebar-genom-title',
            component: 'DesignSystemSidebarPanel',
            props: {
              title: 'Геном 2.0',
              subTitle: 'Обзор',
              activeId: sidebarRule?.activeId ?? 'fw-report',
              items: sidebarRule?.items ?? [
                { id: 'overview', label: 'Обзор', icon: 'circle', selected: false },
                { id: 'fw-report', label: 'Отчет о прошивках', icon: 'layout-grid', selected: true }
              ]
            }
          }
        ]
      },
      {
        id: 'breadcrumbs',
        title: 'Breadcrumbs',
        required: true,
        kind: 'navigation',
        items: [
          {
            id: 'breadcrumbs-genom',
            component: 'DesignSystemBreadcrumb',
            props: {
              model: [{ label: 'Геном 2.0' }, { label: 'Отчёт о прошивках' }]
            }
          }
        ]
      },
      { id: 'header', title: 'Header', required: true, kind: 'header', items: [] },
      { id: 'main', title: 'Main Content', required: true, kind: 'data', items: [] },
      { id: 'actions', title: 'Actions', required: true, kind: 'actions', items: [] }
    ]
    const tableRows = [
      ['Сервер BIOS', 'VADRO Vegman R220 G2', 'VALUE', 'mbo-p15vl-r1.int.skala-ru', 'MSK49-MB.PX-INT-15-M.BXX', 'STATUS'],
      ['Сервер BMC', 'VADRO Vegman R220 G2', 'VALUE', 'mbo-p15vl-r1.int.skala-ru', 'MSK49-MB.PX-INT-15-M.BXX', 'STATUS'],
      ['NIC FW', 'B4Com SN12100', 'VALUE', 'mbo-p15blv-r1.int.skala-ru', 'MSK49-MB.PX-INT-15-M.BXX', 'STATUS'],
      ['HW RAID FW', 'AVAGO MegaRAID SAS 9460-8i', 'VALUE', 'mbo-p15blv-r2.int.skala-ru', 'MSK49-MB.PX-INT-15-M.BXX', 'STATUS'],
      ['HBA controller FW', 'Broadcom / LSI HBA 9400-16i', 'VALUE', 'mbo-p15spl-r1.int.skala-ru', 'MSK49-MB.PX-INT-15-M.BXX', 'STATUS'],
      ['CXD FW', 'Gen2/FatLin_UNIFIED', 'VALUE', 'mbo-p15vlv-r1.int.skala-ru', 'MSK49-MB.PX-INT-15-M.BXX', 'STATUS'],
      ['Коммутатор FW', 'BCOM.S4132U', 'VALUE', 'MS-MSK49-SNE1036', 'MSK49-MB.PX-INT-15-M.BXX', 'STATUS'],
      ['Коммутатор FW', 'DEPO NGN-OS,4184VD', 'VALUE', 'MS-MSK49-SNE1038', 'MSK49-MB.PX-INT-15-M.BXX', 'STATUS']
    ].map(([version, model, serial, node, pak, status], index) => ({
      version,
      model,
      serial,
      node,
      pak,
      status,
      state: index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'warning' : 'healthy'
    }))
    const blocks: EnterpriseBlock[] = [
      {
        id: 'header-title',
        sectionId: 'header',
        kind: 'pageHeader',
        title: 'Отчёт о прошивках',
        component: 'page_header',
        props: { title: 'Отчёт о прошивках' }
      },
      {
        id: 'header-filters-row',
        sectionId: 'header',
        kind: 'filtersBar',
        title: 'Фильтры',
        component: 'Toolbar',
        props: {}
      },
      {
        id: 'filter-search',
        sectionId: 'header',
        kind: 'filtersBar',
        title: 'Поиск',
        component: 'InputText',
        props: { placeholder: 'Input' }
      },
      {
        id: 'filter-zone',
        sectionId: 'header',
        kind: 'filtersBar',
        title: 'Зона',
        component: 'Dropdown',
        props: { placeholder: 'Text' }
      },
      {
        id: 'filter-type',
        sectionId: 'header',
        kind: 'filtersBar',
        title: 'Тип',
        component: 'Dropdown',
        props: { placeholder: 'Text' }
      },
      {
        id: 'main-table',
        sectionId: 'main',
        kind: 'entityTable',
        title: 'Firmware table',
        component: 'DesignSystemDataTable',
        props: { paginator: false, rows: 12, stripedRows: true, size: 'small' }
      },
      {
        id: 'actions-toolbar',
        sectionId: 'actions',
        kind: 'primaryActions',
        title: 'Actions',
        component: 'Toolbar',
        props: {}
      }
    ]
    return {
      version: 'enterprise-screen-plan.v1',
      screenMeta: { kind: 'list', sceneId: 'genom-firmware-report', confidence: 0.92 },
      layout: { requiredSections: ['sidebar', 'breadcrumbs', 'header', 'main', 'actions'] },
      sections,
      blocks,
      dataSchema: {
        entityName: 'firmware',
        fields: [
          { key: 'version', label: 'Версия ПО', type: 'string' },
          { key: 'model', label: 'Компонент: модель', type: 'string' },
          { key: 'serial', label: 'Компонент: серийный номер', type: 'string' },
          { key: 'node', label: 'Узел', type: 'string' },
          { key: 'pak', label: 'ПАК', type: 'string' },
          { key: 'status', label: 'STATUS', type: 'status' }
        ]
      },
      tableSpec: {
        rowCountTarget: 12,
        density: 'compact',
        columns: [
          { key: 'version', label: 'Версия ПО' },
          { key: 'model', label: 'Компонент: модель' },
          { key: 'serial', label: 'Компонент: серийный номер' },
          { key: 'node', label: 'Узел' },
          { key: 'pak', label: 'ПАК' },
          { key: 'status', label: 'STATUS' }
        ],
        sampleRows: tableRows
      },
      interactions: ['обновить', 'экспорт'],
      quality: {
        mustHaveTable: true,
        mustHaveFilters: true,
        mustHaveActions: true,
        mustFillSidebar: true,
        mustFillBreadcrumbs: true
      },
      unknowns: [],
      assumptions: []
    }
  }
  const sections: EnterpriseSection[] = [
    { id: 'sidebar', title: 'Sidebar', required: true, kind: 'navigation', items: [] },
    { id: 'breadcrumbs', title: 'Breadcrumbs', required: true, kind: 'navigation', items: [] },
    { id: 'header', title: 'Header', required: true, kind: 'header', items: [] },
    { id: 'kpis', title: 'KPI Row', required: true, kind: 'status', items: [] },
    { id: 'main', title: 'Main Content', required: true, kind: 'data', items: [] },
    { id: 'actions', title: 'Actions', required: true, kind: 'actions', items: [] }
  ]
  const blocks: EnterpriseBlock[] = [
    {
      id: 'sidebar-summary',
      sectionId: 'sidebar',
      kind: 'summaryPanel',
      title: 'Sidebar Summary',
      component: 'DesignSystemSidebarPanel',
      props: {
        title: 'геном 2.0',
        subTitle: 'Обзор',
        activeId: sidebarRule?.activeId ?? 'overview',
        items: sidebarRule?.items ?? [
          { id: 'overview', label: 'Обзор', icon: 'circle', selected: true },
          { id: 'report', label: 'Отчет', icon: 'layout-grid', selected: false }
        ]
      }
    },
    {
      id: 'breadcrumbs-trail',
      sectionId: 'breadcrumbs',
      kind: 'breadcrumbTrail',
      title: 'Home / Screen',
      component: 'Breadcrumb',
      props: { model: [{ label: 'Home' }, { label: 'Screen' }] }
    },
    {
      id: 'header-title',
      sectionId: 'header',
      kind: 'pageHeader',
      title: 'Page Title',
      component: 'page_header',
      props: { title: 'Page Title' }
    },
    {
      id: 'header-filters',
      sectionId: 'header',
      kind: 'filtersBar',
      title: 'Filters',
      component: 'Dropdown',
      props: { placeholder: 'Filters' }
    },
    {
      id: 'main-table',
      sectionId: 'main',
      kind: 'entityTable',
      title: 'Data Table',
      component: 'DataTable',
      props: { paginator: true, rows: 10, stripedRows: true }
    },
    {
      id: 'actions-toolbar',
      sectionId: 'actions',
      kind: 'primaryActions',
      title: 'Actions',
      component: 'Toolbar',
      props: {}
    }
  ]
  return {
    version: 'enterprise-screen-plan.v1',
    screenMeta: { kind: 'list', sceneId: 'overview-dashboard', confidence },
    layout: {
      requiredSections: sections.filter((section) => section.required).map((section) => section.id)
    },
    sections,
    blocks,
    dataSchema: {
      entityName: 'items',
      fields: [
        { key: 'name', label: 'Элемент', type: 'string' },
        { key: 'status', label: 'Статус', type: 'status' },
        { key: 'updatedAt', label: 'Обновлено', type: 'date' }
      ]
    },
    tableSpec: {
      rowCountTarget: 10,
      density: 'compact',
      columns: []
    },
    interactions: [],
    quality: {
      mustHaveTable: true,
      mustHaveFilters: true,
      mustHaveActions: true,
      mustFillSidebar: true,
      mustFillBreadcrumbs: true
    },
    unknowns: [],
    assumptions: []
  }
}

export function buildAssemblyPlanFromScreenPlan(screenPlan: ScreenPlan): AssemblyPlan {
  return buildAssemblyPlanFromEnterprisePlan(screenPlanToEnterprisePlan(screenPlan))
}

export function enterprisePlanToScreenPlan(plan: EnterpriseScreenPlanV1): ScreenPlan {
  const blockDefaults: Record<EnterpriseBlockKind, { archetypeId: string; preferredComponent: string }> = {
    summaryPanel: { archetypeId: 'navigation', preferredComponent: 'Card' },
    breadcrumbTrail: { archetypeId: 'navigation', preferredComponent: 'Breadcrumb' },
    pageHeader: { archetypeId: 'header', preferredComponent: 'page_header' },
    filtersBar: { archetypeId: 'filters', preferredComponent: 'Dropdown' },
    kpiRow: { archetypeId: 'metric', preferredComponent: 'Toolbar' },
    kpiCard: { archetypeId: 'metric', preferredComponent: 'Card' },
    entityTable: { archetypeId: 'table', preferredComponent: 'DataTable' },
    bulkActions: { archetypeId: 'actions', preferredComponent: 'Toolbar' },
    primaryActions: { archetypeId: 'actions', preferredComponent: 'Toolbar' }
  }
  return {
    sceneId: plan.screenMeta.sceneId,
    confidence: plan.screenMeta.confidence,
    requiredSections: plan.sections.map((section) => ({
      id: section.id,
      title: section.title,
      required: section.required
    })),
    requiredBlocks: plan.blocks.map((block) => ({
      id: block.id,
      sectionId: block.sectionId,
      name: block.title,
      archetypeId: blockDefaults[block.kind].archetypeId,
      preferredComponent: blockDefaults[block.kind].preferredComponent
    })),
    unknowns: [...plan.unknowns],
    assumptions: [...plan.assumptions]
  }
}

function screenPlanToEnterprisePlan(screenPlan: ScreenPlan): EnterpriseScreenPlanV1 {
  const sections: EnterpriseSection[] = screenPlan.requiredSections.map((section) => ({
    id: section.id,
    title: section.title,
    required: section.required,
    kind:
      section.id === 'sidebar' || section.id === 'breadcrumbs'
        ? 'navigation'
        : section.id === 'header'
          ? 'header'
          : section.id === 'actions'
            ? 'actions'
            : section.id === 'kpis'
              ? 'status'
              : 'data'
  }))
  const blocks: EnterpriseBlock[] = screenPlan.requiredBlocks.map((block) => ({
    id: block.id,
    sectionId: block.sectionId,
    kind:
      block.id.includes('breadcrumb')
        ? 'breadcrumbTrail'
        : block.id.includes('filter')
          ? 'filtersBar'
          : block.id.includes('kpi')
            ? 'kpiCard'
            : block.id.includes('table')
              ? 'entityTable'
              : block.sectionId === 'actions'
                ? 'primaryActions'
                : block.sectionId === 'header'
                  ? 'pageHeader'
                  : 'summaryPanel',
    title: block.name
  }))
  return {
    version: 'enterprise-screen-plan.v1',
    screenMeta: {
      kind: screenPlan.sceneId.includes('form') ? 'detail' : 'dashboard',
      sceneId: screenPlan.sceneId,
      confidence: screenPlan.confidence
    },
    layout: { requiredSections: sections.filter((section) => section.required).map((section) => section.id) },
    sections,
    blocks,
    dataSchema: {
      entityName: 'items',
      fields: [
        { key: 'name', label: 'Элемент', type: 'string' },
        { key: 'status', label: 'Статус', type: 'status' }
      ]
    },
    tableSpec: {
      rowCountTarget: 10,
      density: 'compact',
      columns: []
    },
    interactions: [],
    quality: {
      mustHaveTable: true,
      mustHaveFilters: true,
      mustHaveActions: true,
      mustFillSidebar: true,
      mustFillBreadcrumbs: true
    },
    unknowns: [...screenPlan.unknowns],
    assumptions: [...screenPlan.assumptions]
  }
}

export function buildAssemblyPlanFromEnterprisePlan(plan: EnterpriseScreenPlanV1): AssemblyPlan {
  const requiredSections = new Set<string>([
    ...plan.layout.requiredSections,
    ...plan.sections.filter((section) => section.required).map((section) => section.id)
  ])
  if (plan.quality.mustHaveTable) requiredSections.add('main')
  if (plan.quality.mustHaveFilters) requiredSections.add('header')
  if (plan.quality.mustHaveActions) requiredSections.add('actions')
  if (plan.quality.mustFillSidebar) requiredSections.add('sidebar')
  if (plan.quality.mustFillBreadcrumbs) requiredSections.add('breadcrumbs')
  const fields = plan.dataSchema.fields.length > 0 ? plan.dataSchema.fields : []
  const tableSpec = plan.tableSpec
  const rowCountTarget = Math.max(1, tableSpec?.rowCountTarget ?? 10)
  const toTitle = (value: string) =>
    value
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ')
  const resolveComponent = (
    preferred: string | undefined,
    fallback:
      | 'Card'
      | 'Toolbar'
      | 'Dropdown'
      | 'DataTable'
      | 'Button'
      | 'Breadcrumb'
      | 'DesignSystemPageHeader'
  ) => (preferred ? normalizeComponentName(preferred) : fallback)
  const buildRowsFromSchema = (count: number): Array<Record<string, unknown>> =>
    Array.from({ length: count }, (_, index) => {
      const row: Record<string, unknown> = {}
      for (const field of fields) {
        if (field.type === 'number') row[field.key] = index + 1
        else if (field.type === 'date')
          row[field.key] = `2026-01-${String((index % 28) + 1).padStart(2, '0')}`
        else if (field.type === 'status')
          row[field.key] = index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'warning' : 'healthy'
        else row[field.key] = `${field.label} ${index + 1}`
      }
      return row
    })

  const steps: AssemblyStep[] = []
  const blocks = plan.blocks.filter((block) => requiredSections.has(block.sectionId))
  const sectionFilterContainer = new Map<string, string>()
  const dataRows = Array.isArray(tableSpec?.sampleRows) && tableSpec.sampleRows.length > 0
    ? tableSpec.sampleRows
    : buildRowsFromSchema(rowCountTarget)

  for (const section of plan.sections) {
    if (!requiredSections.has(section.id)) continue
    for (const item of section.items ?? []) {
      steps.push({
        id: item.id,
        section: section.id,
        intent: `Create section item ${item.id}`,
        component_id: normalizeComponentName(item.component),
        parent_section_id: section.id,
        props: item.props ?? (item.title ? { title: item.title } : {}),
        expectedChecks: [`${item.id}-created`]
      })
    }
  }

  for (const block of blocks) {
    if (block.kind === 'kpiCard') continue
    if (block.kind === 'kpiRow') {
      steps.push({
        id: block.id,
        section: block.sectionId,
        intent: `Create block ${block.id}`,
        component_id: resolveComponent(block.component, 'Toolbar'),
        parent_section_id: block.sectionId,
        props: block.props ?? {},
        expectedChecks: [`${block.id}-created`]
      })
      continue
    }

    if (block.kind === 'entityTable') {
      const columns =
        tableSpec?.columns && tableSpec.columns.length > 0
          ? tableSpec.columns
          : fields.map((field) => ({ key: field.key, label: field.label }))
      steps.push({
        id: block.id,
        section: block.sectionId,
        intent: `Create block ${block.id}`,
        component_id: resolveComponent(block.component, 'DataTable'),
        parent_section_id: block.sectionId,
        props: {
          paginator: true,
          stripedRows: true,
          rows: Math.min(10, rowCountTarget),
          value: dataRows,
          columns,
          ...(block.props ?? {})
        },
        expectedChecks: [`${block.id}-created`]
      })
      for (const column of columns) {
        steps.push({
          id: `${block.id}-col-${column.key}`,
          section: block.sectionId,
          intent: `Create column ${column.key}`,
          component_id: 'Column',
          parent_step_id: block.id,
          props: { field: column.key, header: column.label },
          expectedChecks: [`${block.id}-col-${column.key}-created`]
        })
      }
      continue
    }

    if (block.kind === 'breadcrumbTrail') {
      const breadcrumbProps =
        block.props ??
        ({
          model: block.title
            .split(/\s*[/>\-→]\s*/g)
            .filter(Boolean)
            .map((label) => ({ label }))
        } as Record<string, unknown>)
      steps.push({
        id: block.id,
        section: block.sectionId,
        intent: `Create block ${block.id}`,
        component_id: resolveComponent(block.component, 'Breadcrumb'),
        parent_section_id: block.sectionId,
        props: breadcrumbProps,
        expectedChecks: [`${block.id}-created`]
      })
      continue
    }

    if (block.kind === 'pageHeader') {
      steps.push({
        id: block.id,
        section: block.sectionId,
        intent: `Create block ${block.id}`,
        component_id: resolveComponent(block.component, 'DesignSystemPageHeader'),
        parent_section_id: block.sectionId,
        props: block.props ?? { title: block.title },
        expectedChecks: [`${block.id}-created`]
      })
      continue
    }

    const fallbackComponent =
      block.kind === 'filtersBar'
        ? 'Dropdown'
        : block.kind === 'primaryActions' || block.kind === 'bulkActions'
          ? 'Toolbar'
          : 'Card'
    const isFilterContainer =
      block.kind === 'filtersBar' &&
      resolveComponent(block.component, fallbackComponent) === 'Toolbar'
    const filterParentId =
      block.kind === 'filtersBar' && !isFilterContainer ? sectionFilterContainer.get(block.sectionId) : undefined
    steps.push({
      id: block.id,
      section: block.sectionId,
      intent: `Create block ${block.id}`,
      component_id: resolveComponent(block.component, fallbackComponent),
      parent_section_id: filterParentId ? undefined : block.sectionId,
      parent_step_id: filterParentId,
      slot_name: filterParentId ? 'start' : undefined,
      props: block.props ?? (block.title ? { title: block.title, placeholder: block.title } : {}),
      expectedChecks: [`${block.id}-created`]
    })
    if (isFilterContainer) sectionFilterContainer.set(block.sectionId, block.id)
  }

  const kpiRow = blocks.find((block) => block.kind === 'kpiRow')
  if (kpiRow) {
    for (const kpi of blocks.filter((block) => block.kind === 'kpiCard')) {
      steps.push({
        id: kpi.id,
        section: kpi.sectionId,
        intent: `Create KPI ${kpi.id}`,
        component_id: resolveComponent(kpi.component, 'Card'),
        parent_step_id: kpiRow.id,
        slot_name: 'start',
        props: kpi.props ?? { title: kpi.title, subTitle: '—' },
        expectedChecks: [`${kpi.id}-created`]
      })
    }
  }

  const actionContainers = blocks.filter(
    (block) => block.kind === 'primaryActions' || block.kind === 'bulkActions'
  )
  for (const actionContainer of actionContainers) {
    const containerId = actionContainer.id
    for (const interaction of plan.interactions) {
      const actionId = `${containerId}-${interaction}`
      steps.push({
        id: actionId,
        section: actionContainer.sectionId,
        intent: `Create action ${actionId}`,
        component_id: 'Button',
        parent_step_id: containerId,
        slot_name: 'start',
        props: { label: toTitle(interaction) || interaction },
        expectedChecks: [`${actionId}-created`]
      })
    }
  }

  return { steps: steps.filter((step) => requiredSections.has(step.section)) }
}

export function repairEnterpriseScreenPlan(
  plan: EnterpriseScreenPlanV1,
  failReasons: string[]
): EnterpriseScreenPlanV1 {
  const normalized = failReasons.join(' ').toLowerCase()
  const next: EnterpriseScreenPlanV1 = {
    ...plan,
    sections: [...plan.sections],
    blocks: [...plan.blocks],
    interactions: [...plan.interactions],
    quality: { ...plan.quality },
    unknowns: [...plan.unknowns],
    assumptions: [...plan.assumptions]
  }
  const hasBlock = (kind: EnterpriseBlockKind) => next.blocks.some((block) => block.kind === kind)
  if (normalized.includes('hastable=false') || normalized.includes('missing main table')) {
    if (!hasBlock('entityTable')) {
      next.blocks.push({
        id: 'repair-main-table',
        sectionId: 'main',
        kind: 'entityTable',
        title: 'Primary data table'
      })
    }
    next.quality.mustHaveTable = true
  }
  if (normalized.includes('hasfilters=false') || normalized.includes('filters')) {
    if (!hasBlock('filtersBar')) {
      next.blocks.push({
        id: 'repair-filters',
        sectionId: 'header',
        kind: 'filtersBar',
        title: 'Filters'
      })
    }
    next.quality.mustHaveFilters = true
  }
  if (normalized.includes('hasactions=false') || normalized.includes('actions')) {
    if (!hasBlock('primaryActions')) {
      next.blocks.push({
        id: 'repair-actions',
        sectionId: 'actions',
        kind: 'primaryActions',
        title: 'Primary actions'
      })
    }
    next.quality.mustHaveActions = true
  }
  if (normalized.includes('hassidebarcontent=false')) {
    if (!next.layout.requiredSections.includes('sidebar')) next.layout.requiredSections.push('sidebar')
    next.quality.mustFillSidebar = true
  }
  if (normalized.includes('hasbreadcrumbscontent=false')) {
    if (!next.layout.requiredSections.includes('breadcrumbs')) next.layout.requiredSections.push('breadcrumbs')
    next.quality.mustFillBreadcrumbs = true
  }
  return next
}

export function evaluateQualityGate(args: {
  nodeCount: number
  requiredSections: string[]
  presentSections: string[]
  missingComponents: string[]
  unresolvedParentLinks?: number
  repairAttempts: number
  enterprise?: EnterpriseQualitySignals
}): QualityGateResult {
  const placeholderRatio = args.nodeCount === 0 ? 1 : args.missingComponents.length / args.nodeCount
  const checks = [
    {
      id: 'min-node-count',
      passed: args.nodeCount >= 6,
      detail: `nodeCount=${args.nodeCount} (required >= 6)`
    },
    {
      id: 'required-sections',
      passed: args.requiredSections.every((s) => args.presentSections.includes(s)),
      detail: `present=${args.presentSections.join(', ')}`
    },
    {
      id: 'placeholder-ratio',
      passed: placeholderRatio <= 0.2,
      detail: `placeholderRatio=${placeholderRatio.toFixed(2)} (required <= 0.20)`
    },
    {
      id: 'unresolved-parent-links',
      passed: (args.unresolvedParentLinks ?? 0) === 0,
      detail: `unresolvedParentLinks=${args.unresolvedParentLinks ?? 0}`
    },
    {
      id: 'enterprise-data-section',
      passed: args.enterprise?.hasDataSection ?? true,
      detail: `hasDataSection=${args.enterprise?.hasDataSection ?? true}`
    },
    {
      id: 'enterprise-table',
      passed: args.enterprise?.hasTable ?? true,
      detail: `hasTable=${args.enterprise?.hasTable ?? true}`
    },
    {
      id: 'enterprise-filters',
      passed: args.enterprise?.hasFilters ?? true,
      detail: `hasFilters=${args.enterprise?.hasFilters ?? true}`
    },
    {
      id: 'enterprise-actions',
      passed: args.enterprise?.hasActions ?? true,
      detail: `hasActions=${args.enterprise?.hasActions ?? true}`
    },
    {
      id: 'enterprise-sidebar',
      passed: args.enterprise?.hasSidebarContent ?? true,
      detail: `hasSidebarContent=${args.enterprise?.hasSidebarContent ?? true}`
    },
    {
      id: 'enterprise-breadcrumbs',
      passed: args.enterprise?.hasBreadcrumbsContent ?? true,
      detail: `hasBreadcrumbsContent=${args.enterprise?.hasBreadcrumbsContent ?? true}`
    },
    {
      id: 'enterprise-table-density',
      passed: (args.enterprise?.tableRowCount ?? (args.enterprise?.minTableRows ?? 10)) >= (args.enterprise?.minTableRows ?? 10),
      detail: `tableRowCount=${args.enterprise?.tableRowCount ?? 0} (required >= ${args.enterprise?.minTableRows ?? 10})`
    },
    {
      id: 'enterprise-table-columns',
      passed:
        (args.enterprise?.tableColumnCount ?? (args.enterprise?.minTableColumns ?? 4)) >=
        (args.enterprise?.minTableColumns ?? 4),
      detail: `tableColumnCount=${args.enterprise?.tableColumnCount ?? 0} (required >= ${args.enterprise?.minTableColumns ?? 4})`
    },
    {
      id: 'enterprise-domain-columns',
      passed: args.enterprise?.domainColumnsPresent ?? true,
      detail: `domainColumnsPresent=${args.enterprise?.domainColumnsPresent ?? true}`
    },
    {
      id: 'json-structure-match',
      passed: args.enterprise?.jsonStructureMatch ?? true,
      detail: `jsonStructureMatch=${args.enterprise?.jsonStructureMatch ?? true}`
    }
  ]
  const failReasons = checks.filter((check) => !check.passed).map((check) => check.detail)
  return {
    passed: checks.every((check) => check.passed),
    checks,
    missingComponents: args.missingComponents,
    repairAttempts: args.repairAttempts,
    finalNodeCount: args.nodeCount,
    failReasons
  }
}
