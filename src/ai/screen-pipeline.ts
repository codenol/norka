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

export function buildDeterministicScreenPlan(brief: string, source: string): ScreenPlan {
  const enterprise = buildEnterpriseScreenPlan(brief, source)
  return enterprisePlanToScreenPlan(enterprise)
}

export function buildEnterpriseScreenPlan(brief: string, source: string): EnterpriseScreenPlanV1 {
  const content = `${brief}\n${source}`.trim()
  const confidence = content.length > 0 ? 0.7 : 0.55
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
      component: 'Card',
      props: { title: 'Sidebar Summary' }
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
      component: 'Card',
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
    pageHeader: { archetypeId: 'header', preferredComponent: 'Card' },
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
  const requiredSections = new Set(plan.layout.requiredSections)
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
    fallback: 'Card' | 'Toolbar' | 'Dropdown' | 'DataTable' | 'Button' | 'Breadcrumb'
  ) => preferred ?? fallback
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
        component_id: item.component,
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
          ...(block.props ?? {})
        },
        expectedChecks: [`${block.id}-created`]
      })
      const columns =
        tableSpec?.columns && tableSpec.columns.length > 0
          ? tableSpec.columns
          : fields.map((field) => ({ key: field.key, label: field.label }))
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

    const fallbackComponent =
      block.kind === 'filtersBar'
        ? 'Dropdown'
        : block.kind === 'primaryActions' || block.kind === 'bulkActions'
          ? 'Toolbar'
          : 'Card'
    steps.push({
      id: block.id,
      section: block.sectionId,
      intent: `Create block ${block.id}`,
      component_id: resolveComponent(block.component, fallbackComponent),
      parent_section_id: block.sectionId,
      props: block.props ?? (block.title ? { title: block.title, placeholder: block.title } : {}),
      expectedChecks: [`${block.id}-created`]
    })
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
