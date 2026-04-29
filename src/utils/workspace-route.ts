import type { PipelineStep } from '@/composables/use-projects'

export interface WorkspaceRouteContext {
  productId: string
  screenId: string
  featureId: string
}

const PIPELINE_STEP_SET = new Set<PipelineStep>(['analytics', 'design', 'discussion', 'handoff'])

export function isPipelineStep(value: unknown): value is PipelineStep {
  return typeof value === 'string' && PIPELINE_STEP_SET.has(value as PipelineStep)
}

export function buildWorkspacePath(step: PipelineStep, context: WorkspaceRouteContext): string {
  return `/workspace/${context.productId}/${context.screenId}/${context.featureId}/${step}`
}
