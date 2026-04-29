import { describe, expect, it } from 'bun:test'

import {
  buildAssemblyPlanFromScreenPlan,
  buildDeterministicScreenPlan,
  evaluateQualityGate
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
