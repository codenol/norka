/**
 * code-connect — maps design component nodes to code components.
 *
 * The Code Connect Map bridges the gap between INSTANCE/COMPONENT nodes in
 * the Береста scene graph and real UI library imports, enabling:
 *   - Design → Code: `selectionToCode()` emits `<Button>` instead of `<Frame>`
 *   - Code → Canvas: `reverseMap` resolves code component names back to library refs
 *
 * Persistence: localStorage['norka:code-connect'] — JSON serialised map.
 *
 * Each entry is keyed by the COMPONENT node ID from the library graph. Entries
 * are seeded as stubs when a library is registered (`seedFromLibrary`) and
 * cleaned up when a library is removed (`pruneLibrary`).
 */

import { shallowRef, computed } from 'vue'
import type { ShallowRef, ComputedRef } from 'vue'

import { libraryRegistry } from '@norka/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentRule {
  usage: string
  constraints: string[]
  examples: string[]
  antiPatterns: string[]
  updatedAt: string
  updatedBy: 'designer' | 'ai'
}

export interface CodeConnectEntry {
  componentNodeId: string          // ID of the COMPONENT node in the library graph
  designName: string               // e.g. "Button/Primary" — display only
  libraryId: string                // which library this component belongs to
  codeComponent: string            // e.g. "Button" — emitted in generated JSX/TSX/Vue
  importPath: string               // e.g. "@ds/ui" or "~/components/Button.vue"
  staticProps: Record<string, unknown>  // e.g. { variant: "primary", size: "md" }
  rules: ComponentRule | null      // usage rules; null = not yet defined
}

export type CodeConnectMap = Record<string, CodeConnectEntry>

export interface CodeConnectStore {
  map: ShallowRef<CodeConnectMap>
  upsertEntry(entry: CodeConnectEntry): void
  removeEntry(componentNodeId: string): void
  getEntry(componentNodeId: string): CodeConnectEntry | null
  seedFromLibrary(libraryId: string): void
  pruneLibrary(libraryId: string): void
  /**
   * reverseMap: codeComponent name → library reference for Code → Canvas flow.
   * Only entries with non-empty codeComponent are included.
   */
  reverseMap: ComputedRef<Map<string, { libraryId: string; itemId: string }>>
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'norka:code-connect'

function loadMap(): CodeConnectMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CodeConnectMap) : {}
  } catch (err) {
    console.error('[code-connect] Failed to load map from localStorage:', err)
    return {}
  }
}

function saveMap(map: CodeConnectMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch (err) {
    console.warn('[code-connect] Failed to save map to localStorage:', err)
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const _map = shallowRef<CodeConnectMap>(loadMap())

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function upsertEntry(entry: CodeConnectEntry): void {
  _map.value = { ..._map.value, [entry.componentNodeId]: entry }
  saveMap(_map.value)
}

function removeEntry(componentNodeId: string): void {
  const next = { ..._map.value }
  delete next[componentNodeId]
  _map.value = next
  saveMap(_map.value)
}

function getEntry(componentNodeId: string): CodeConnectEntry | null {
  return _map.value[componentNodeId] ?? null
}

/**
 * Seed stubs for all COMPONENT/COMPONENT_SET nodes from a library that do not
 * yet have an entry in the map. Called after libraryRegistry.register().
 */
function seedFromLibrary(libraryId: string): void {
  const components = libraryRegistry.getComponents(libraryId)
  if (components.length === 0) return

  let changed = false
  const next = { ..._map.value }

  for (const { node } of components) {
    if (Object.prototype.hasOwnProperty.call(next, node.id)) continue  // already mapped
    next[node.id] = {
      componentNodeId: node.id,
      designName: node.name,
      libraryId,
      codeComponent: '',
      importPath: '',
      staticProps: {},
      rules: null,
    }
    changed = true
  }

  if (changed) {
    _map.value = next
    saveMap(next)
  }
}

/**
 * Remove all entries belonging to a library. Called when a library is removed.
 */
function pruneLibrary(libraryId: string): void {
  const next: CodeConnectMap = {}
  let changed = false

  for (const [id, entry] of Object.entries(_map.value)) {
    if (entry.libraryId === libraryId) {
      changed = true
    } else {
      next[id] = entry
    }
  }

  if (changed) {
    _map.value = next
    saveMap(next)
  }
}

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const reverseMap: ComputedRef<Map<string, { libraryId: string; itemId: string }>> = computed(() => {
  const result = new Map<string, { libraryId: string; itemId: string }>()
  for (const entry of Object.values(_map.value)) {
    if (!entry.codeComponent) continue
    result.set(entry.codeComponent, {
      libraryId: entry.libraryId,
      itemId: entry.componentNodeId,
    })
  }
  return result
})

// ---------------------------------------------------------------------------
// Public store
// ---------------------------------------------------------------------------

const store: CodeConnectStore = {
  map: _map,
  upsertEntry,
  removeEntry,
  getEntry,
  seedFromLibrary,
  pruneLibrary,
  reverseMap,
}

export function useCodeConnectStore(): CodeConnectStore {
  return store
}
