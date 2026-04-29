export type PipelineStage = 'planning' | 'assembly' | 'validation' | 'complete' | 'failed'

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

function includesAny(source: string, words: string[]): boolean {
  return words.some((word) => source.includes(word))
}

export function buildDeterministicScreenPlan(brief: string, source: string): ScreenPlan {
  const content = `${brief}\n${source}`.toLowerCase()
  const hasTable = includesAny(content, ['табл', 'table', 'список'])
  const hasStatus = includesAny(content, ['healthy', 'warning', 'critical', 'статус'])
  const hasActions = includesAny(content, ['кноп', 'действ', 'cta', 'alert'])
  const hasFilters = includesAny(content, ['фильтр', 'период', 'date', 'calendar'])
  const confidenceSignals = [hasTable, hasStatus, hasActions, hasFilters].filter(Boolean).length
  const confidence = Math.min(0.9, 0.55 + confidenceSignals * 0.1)
  const sceneId = hasTable ? 'overview-dashboard' : 'form-workflow'
  const requiredSections: ScreenPlanSection[] = [
    { id: 'sidebar', title: 'Sidebar', required: true },
    { id: 'breadcrumbs', title: 'Breadcrumbs', required: true },
    { id: 'header', title: 'Header', required: true },
    { id: 'kpis', title: 'KPI Cards', required: true },
    { id: 'main', title: 'Main Content', required: true },
    { id: 'actions', title: 'Actions', required: true }
  ]
  const mainComponent = hasTable ? 'DataTable' : 'Card'
  const actionComponent = hasActions ? 'Toolbar' : 'Button'
  const requiredBlocks: ScreenPlanBlock[] = [
    {
      id: 'sidebar-overview',
      sectionId: 'sidebar',
      name: 'Sidebar overview',
      archetypeId: 'navigation',
      preferredComponent: 'Card'
    },
    {
      id: 'breadcrumbs',
      sectionId: 'breadcrumbs',
      name: 'Breadcrumb trail',
      archetypeId: 'navigation',
      preferredComponent: 'Breadcrumb'
    },
    {
      id: 'page-title',
      sectionId: 'header',
      name: 'Page title',
      archetypeId: 'header',
      preferredComponent: 'Card'
    },
    {
      id: 'kpi-grid',
      sectionId: 'kpis',
      name: 'KPI grid',
      archetypeId: 'metric',
      preferredComponent: 'Card'
    },
    {
      id: 'main-table',
      sectionId: 'main',
      name: 'Primary data table',
      archetypeId: 'table',
      preferredComponent: mainComponent
    },
    {
      id: 'quick-actions',
      sectionId: 'actions',
      name: 'Primary actions',
      archetypeId: 'actions',
      preferredComponent: actionComponent
    }
  ]
  if (hasFilters) {
    requiredBlocks.push({
      id: 'filters',
      sectionId: 'header',
      name: 'Filters',
      archetypeId: 'filters',
      preferredComponent: 'Dropdown'
    })
  }
  const unknowns: string[] = []
  if (!content.includes('warning') || !content.includes('critical')) {
    unknowns.push('Threshold policy for warning/critical states is missing')
  }
  if (!content.includes('метрик') && !content.includes('metric')) {
    unknowns.push('Detailed metrics interpretation is missing')
  }
  return {
    sceneId,
    confidence,
    requiredSections,
    requiredBlocks,
    unknowns,
    assumptions: unknowns.map((u) => `Assumption: ${u}`)
  }
}

export function buildAssemblyPlanFromScreenPlan(screenPlan: ScreenPlan): AssemblyPlan {
  const steps: AssemblyStep[] = [
    {
      id: 'sidebar-summary',
      section: 'sidebar',
      intent: 'Create sidebar summary card',
      component_id: 'Card',
      parent_section_id: 'sidebar',
      props: { title: 'Слои экрана', subTitle: 'Сводка структуры' },
      expectedChecks: ['sidebar-summary-created']
    },
    {
      id: 'sidebar-nav-analytics',
      section: 'sidebar',
      intent: 'Create sidebar analytics nav action',
      component_id: 'Button',
      parent_section_id: 'sidebar',
      props: { label: 'Аналитика', severity: 'secondary' },
      expectedChecks: ['sidebar-nav-analytics-created']
    },
    {
      id: 'sidebar-nav-design',
      section: 'sidebar',
      intent: 'Create sidebar design nav action',
      component_id: 'Button',
      parent_section_id: 'sidebar',
      props: { label: 'Прототип', severity: 'secondary' },
      expectedChecks: ['sidebar-nav-design-created']
    },
    {
      id: 'breadcrumbs-main',
      section: 'breadcrumbs',
      intent: 'Create breadcrumb trail in existing header slot',
      component_id: 'Breadcrumb',
      parent_section_id: 'breadcrumbs',
      props: { model: [{ label: 'Проекты' }, { label: 'Каталог' }, { label: 'Пагинация' }] },
      expectedChecks: ['breadcrumbs-main-created']
    },
    {
      id: 'header-title',
      section: 'header',
      intent: 'Create page header card',
      component_id: 'Card',
      parent_section_id: 'header',
      props: { title: 'Корзина — обзор', subTitle: 'Сводка по состоянию товаров' },
      expectedChecks: ['header-title-created']
    },
    {
      id: 'header-filter',
      section: 'header',
      intent: 'Create header filter',
      component_id: 'Dropdown',
      parent_section_id: 'header',
      props: { placeholder: 'Период' },
      expectedChecks: ['header-filter-created']
    },
    {
      id: 'kpi-row',
      section: 'kpis',
      intent: 'Create horizontal KPI frame',
      component_id: 'Toolbar',
      parent_section_id: 'kpis',
      expectedChecks: ['kpi-row-created']
    },
    {
      id: 'kpi-total',
      section: 'kpis',
      intent: 'Create total KPI card',
      component_id: 'Card',
      parent_step_id: 'kpi-row',
      slot_name: 'start',
      props: { title: 'Всего товаров', subTitle: '3' },
      expectedChecks: ['kpi-total-created']
    },
    {
      id: 'kpi-critical',
      section: 'kpis',
      intent: 'Create critical KPI card',
      component_id: 'Card',
      parent_step_id: 'kpi-row',
      slot_name: 'start',
      props: { title: 'Critical', subTitle: '1' },
      expectedChecks: ['kpi-critical-created']
    },
    {
      id: 'kpi-warning',
      section: 'kpis',
      intent: 'Create warning KPI card',
      component_id: 'Card',
      parent_step_id: 'kpi-row',
      slot_name: 'start',
      props: { title: 'Warning', subTitle: '1' },
      expectedChecks: ['kpi-warning-created']
    },
    {
      id: 'kpi-healthy',
      section: 'kpis',
      intent: 'Create healthy KPI card',
      component_id: 'Card',
      parent_step_id: 'kpi-row',
      slot_name: 'start',
      props: { title: 'Healthy', subTitle: '1' },
      expectedChecks: ['kpi-healthy-created']
    },
    {
      id: 'main-table',
      section: 'main',
      intent: 'Create items table',
      component_id: 'DataTable',
      parent_section_id: 'main',
      props: {
        paginator: true,
        rows: 5,
        stripedRows: true,
        value: [
          { name: 'Товар A', quantity: 10, price: 100, status: 'healthy' },
          { name: 'Товар B', quantity: 2, price: 250, status: 'warning' },
          { name: 'Товар C', quantity: 0, price: 500, status: 'critical' }
        ]
      },
      expectedChecks: ['main-table-created']
    },
    {
      id: 'main-col-name',
      section: 'main',
      intent: 'Create name column',
      component_id: 'Column',
      parent_step_id: 'main-table',
      props: { field: 'name', header: 'Товар' },
      expectedChecks: ['main-col-name-created']
    },
    {
      id: 'main-col-quantity',
      section: 'main',
      intent: 'Create quantity column',
      component_id: 'Column',
      parent_step_id: 'main-table',
      props: { field: 'quantity', header: 'Количество' },
      expectedChecks: ['main-col-quantity-created']
    },
    {
      id: 'main-col-price',
      section: 'main',
      intent: 'Create price column',
      component_id: 'Column',
      parent_step_id: 'main-table',
      props: { field: 'price', header: 'Цена' },
      expectedChecks: ['main-col-price-created']
    },
    {
      id: 'main-col-status',
      section: 'main',
      intent: 'Create status column',
      component_id: 'Column',
      parent_step_id: 'main-table',
      props: { field: 'status', header: 'Статус' },
      expectedChecks: ['main-col-status-created']
    },
    {
      id: 'actions-toolbar',
      section: 'actions',
      intent: 'Create actions toolbar',
      component_id: 'Toolbar',
      parent_section_id: 'actions',
      expectedChecks: ['actions-toolbar-created']
    },
    {
      id: 'actions-refresh',
      section: 'actions',
      intent: 'Create refresh action button',
      component_id: 'Button',
      parent_step_id: 'actions-toolbar',
      slot_name: 'start',
      props: { label: 'Обновить' },
      expectedChecks: ['actions-refresh-created']
    },
    {
      id: 'actions-alert',
      section: 'actions',
      intent: 'Create alert simulation action button',
      component_id: 'Button',
      parent_step_id: 'actions-toolbar',
      slot_name: 'start',
      props: { label: 'Симулировать алерт', severity: 'secondary' },
      expectedChecks: ['actions-alert-created']
    }
  ]

  const required = new Set(screenPlan.requiredSections.map((section) => section.id))
  return { steps: steps.filter((step) => required.has(step.section)) }
}

export function evaluateQualityGate(args: {
  nodeCount: number
  requiredSections: string[]
  presentSections: string[]
  missingComponents: string[]
  unresolvedParentLinks?: number
  repairAttempts: number
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
