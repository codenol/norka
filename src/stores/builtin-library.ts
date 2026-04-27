/**
 * builtin-library — registers and manages the built-in PrimeReact Core library.
 *
 * This library is registered directly on `libraryRegistry` at app startup
 * (before user libraries are loaded) without a .pen file. Its components are
 * injected into every document's `__library_components__` page via
 * `injectBuiltinComponentsToGraph()`, making them visible to the AI's
 * `get_components` tool.
 *
 * The library is NOT listed in `_manifests` (the user-visible library list)
 * and cannot be removed by the user.
 */

import {
  libraryRegistry,
  LibraryRegistry,
  buildPrimeReactGraph,
  PRIMEREACT_CONNECT_DEFS,
} from '@norka/core'

import { useCodeConnectStore } from './code-connect'

import type { SceneGraph } from '@norka/core'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BUILTIN_PRIMEREACT_ID = 'builtin:primereact-core'

export function isBuiltinLibrary(id: string): boolean {
  return id.startsWith('builtin:')
}

// ---------------------------------------------------------------------------
// Init — called once at app startup from main.ts
// ---------------------------------------------------------------------------

export function initBuiltinLibraries(): void {
  if (libraryRegistry.has(BUILTIN_PRIMEREACT_ID)) return  // idempotent

  const graph = buildPrimeReactGraph()
  const manifest = LibraryRegistry.buildManifest(BUILTIN_PRIMEREACT_ID, 'PrimeReact (Core)', graph)
  libraryRegistry.register(manifest, graph)

  // Seed Code Connect entries with pre-defined PrimeReact definitions,
  // skipping any that the user has already customised (getEntry returns non-null).
  const codeConnect = useCodeConnectStore()
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'COMPONENT') continue
    const def = PRIMEREACT_CONNECT_DEFS[node.name]
    if (codeConnect.getEntry(node.id)) continue  // preserve user overrides
    codeConnect.upsertEntry({
      componentNodeId: node.id,
      designName: node.name,
      libraryId: BUILTIN_PRIMEREACT_ID,
      codeComponent: def.codeComponent,
      importPath: def.importPath,
      staticProps: def.staticProps,
      rules: null,
    })
  }
}

// ---------------------------------------------------------------------------
// Graph injection — called from enableForGraph() in library.ts
// ---------------------------------------------------------------------------

/**
 * Copy all PrimeReact COMPONENT nodes from the built-in library into the
 * document graph's `__library_components__` internal page.
 *
 * Idempotent: `findLocalComponent` checks for existing `libraryRef` markers,
 * so components are never duplicated across multiple calls.
 */
export function injectBuiltinComponentsToGraph(graph: SceneGraph): void {
  const libGraph = libraryRegistry.getGraph(BUILTIN_PRIMEREACT_ID)
  if (!libGraph) return

  for (const node of libGraph.getAllNodes()) {
    if (node.type !== 'COMPONENT') continue
    const existing = libraryRegistry.findLocalComponent(BUILTIN_PRIMEREACT_ID, node.id, graph)
    if (!existing) {
      libraryRegistry.copyComponentToGraph(BUILTIN_PRIMEREACT_ID, node.id, graph)
    }
  }
}
