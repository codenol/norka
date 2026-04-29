import { describe, expect, it } from 'bun:test'

import {
  buildAssemblyPlanFromEnterprisePlan,
  buildAssemblyPlanFromScreenPlan,
  buildDeterministicScreenPlan,
  buildEnterpriseScreenPlan,
  buildRenderTree,
  evaluateQualityGate,
  normalizeComponentName,
  normalizeRenderPlan,
  RENDER_CONTRACT_VERSION
} from '@/ai/screen-pipeline'
import { getPrimeCoverageForDemoScenes, getPrimeCoverageSnapshot } from '@/composables/use-primereact-preview'

describe('screen pipeline contracts', () => {
  it('builds deterministic screen and assembly plans', () => {
    const screenPlan = buildDeterministicScreenPlan('task metrics warning critical', 'source')
    const assemblyPlan = buildAssemblyPlanFromScreenPlan(screenPlan)
    expect(screenPlan.requiredSections.length).toBeGreaterThanOrEqual(4)
    expect(assemblyPlan.steps.length).toBeGreaterThanOrEqual(4)
  })

  it('evaluates quality gate failure for incomplete draft', () => {
    const result = evaluateQualityGate({
      nodeCount: 3,
      requiredSections: ['header', 'kpis'],
      presentSections: ['header'],
      missingComponents: ['node-1'],
      repairAttempts: 1
    })
    expect(result.passed).toBe(false)
    expect(result.failReasons.length).toBeGreaterThan(0)
  })

  it('normalizes valid render contract payload', () => {
    const enterprise = buildEnterpriseScreenPlan('firmware report', 'source')
    const payload = {
      contractVersion: RENDER_CONTRACT_VERSION,
      enterpriseScreenPlan: enterprise,
      assemblyPlan: buildAssemblyPlanFromEnterprisePlan(enterprise)
    }
    const normalized = normalizeRenderPlan(payload)
    expect(normalized.ok).toBe(true)
    if (normalized.ok) {
      expect(normalized.contractVersion).toBe(RENDER_CONTRACT_VERSION)
      expect(normalized.assemblyPlan.steps.length).toBeGreaterThan(0)
    }
  })

  it('rejects invalid render contract payload', () => {
    const normalized = normalizeRenderPlan({ contractVersion: RENDER_CONTRACT_VERSION })
    expect(normalized.ok).toBe(false)
    if (!normalized.ok) {
      expect(normalized.diagnostics.length).toBeGreaterThan(0)
    }
  })

  it('builds zoned render tree from normalized payload', () => {
    const enterprise = buildEnterpriseScreenPlan('firmware report', 'source')
    const normalized = normalizeRenderPlan({
      contractVersion: RENDER_CONTRACT_VERSION,
      enterpriseScreenPlan: enterprise,
      assemblyPlan: buildAssemblyPlanFromEnterprisePlan(enterprise)
    })
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return
    const tree = buildRenderTree(normalized.enterpriseScreenPlan, normalized.assemblyPlan)
    expect(tree.sidebar.length).toBeGreaterThan(0)
    expect(tree.breadcrumbs.length).toBeGreaterThan(0)
    expect(tree.main.length + tree.actions.length).toBeGreaterThan(0)
  })

  it('normalizes legacy component aliases to design-system ids', () => {
    expect(normalizeComponentName('BreadCrumbs')).toBe('DesignSystemBreadcrumb')
    expect(normalizeComponentName('Breadcrum')).toBe('DesignSystemBreadcrumb')
    expect(normalizeComponentName('Breadcrumb')).toBe('DesignSystemBreadcrumb')
    expect(normalizeComponentName('DataTableDynamic')).toBe('DesignSystemDataTable')
    expect(normalizeComponentName('StatusBadge')).toBe('DesignSystemStatusBadge')
  })
})

describe('prime catalog coverage', () => {
  it('returns component contract coverage snapshot', () => {
    const snapshot = getPrimeCoverageSnapshot()
    expect(snapshot.total).toBeGreaterThan(20)
    expect(snapshot.missingContracts.length).toBe(0)
  })

  it('reports demo scene compatibility', () => {
    const scenes = getPrimeCoverageForDemoScenes()
    expect(scenes.length).toBeGreaterThan(0)
    expect(scenes.every((scene) => scene.compatible)).toBe(true)
  })
})
