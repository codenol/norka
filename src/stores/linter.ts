/**
 * Linter store — reactive wrapper around the core Linter.
 *
 * Auto-runs with a debounce on every scene change when the Lint panel is open.
 * Can also be triggered manually via run().
 */

import { shallowRef } from 'vue'

import { createLinter } from '@open-pencil/core'

import type { LintResult, SceneGraph } from '@open-pencil/core'

export type LintPreset = 'recommended' | 'strict' | 'accessibility'

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

const _results = shallowRef<LintResult | null>(null)
const _loading = shallowRef(false)
const _preset = shallowRef<LintPreset>('recommended')
const _activePageOnly = shallowRef(false)
const _debounceMs = 1500

let _debounceTimer: ReturnType<typeof setTimeout> | null = null

// ---------------------------------------------------------------------------
// Core run logic
// ---------------------------------------------------------------------------

function run(graph: SceneGraph, currentPageId?: string): LintResult {
  _loading.value = true
  const linter = createLinter({ preset: _preset.value })
  const rootIds = _activePageOnly.value && currentPageId ? [currentPageId] : undefined
  const result = linter.lintGraph(graph, rootIds)
  _results.value = result
  _loading.value = false
  return result
}

/**
 * Debounced run — call this on every scene change tick.
 * Only fires when the panel is open (caller must decide).
 */
function scheduledRun(graph: SceneGraph, currentPageId?: string): void {
  if (_debounceTimer !== null) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    run(graph, currentPageId)
  }, _debounceMs)
}

function cancelScheduled(): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
}

function setPreset(preset: LintPreset): void {
  _preset.value = preset
}

function setActivePageOnly(v: boolean): void {
  _activePageOnly.value = v
}

function clear(): void {
  cancelScheduled()
  _results.value = null
}

// ---------------------------------------------------------------------------
// Public store object
// ---------------------------------------------------------------------------

export interface LinterStore {
  results: typeof _results
  loading: typeof _loading
  preset: typeof _preset
  activePageOnly: typeof _activePageOnly
  run: typeof run
  scheduledRun: typeof scheduledRun
  cancelScheduled: typeof cancelScheduled
  setPreset: typeof setPreset
  setActivePageOnly: typeof setActivePageOnly
  clear: typeof clear
}

const store: LinterStore = {
  results: _results,
  loading: _loading,
  preset: _preset,
  activePageOnly: _activePageOnly,
  run,
  scheduledRun,
  cancelScheduled,
  setPreset,
  setActivePageOnly,
  clear,
}

export function useLinterStore(): LinterStore {
  return store
}
