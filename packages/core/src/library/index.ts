/**
 * LibraryRegistry — manages design system libraries.
 *
 * A library is a parsed SceneGraph from a .fig/.pen file whose
 * components, variables, and styles are made available across documents.
 *
 * Usage:
 *   libraryRegistry.register(manifest, graph)
 *   libraryRegistry.injectIntoGraph(libraryId, targetGraph)
 *   libraryRegistry.copyComponentToGraph(libraryId, componentId, targetGraph)
 */

import type {
  SceneGraph,
  SceneNode,
  Variable,
  VariableCollection,
  NamedStyle
} from '../scene-graph'

export interface LibraryManifest {
  id: string
  name: string
  addedAt: string
  componentCount: number
  variableCount: number
  styleCount: number
}

interface LibraryEntry {
  manifest: LibraryManifest
  graph: SceneGraph
}

export class LibraryRegistry {
  private _libraries = new Map<string, LibraryEntry>()

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  register(manifest: LibraryManifest, graph: SceneGraph): void {
    this._libraries.set(manifest.id, { manifest, graph })
  }

  unregister(id: string): void {
    this._libraries.delete(id)
  }

  has(id: string): boolean {
    return this._libraries.has(id)
  }

  getAll(): LibraryManifest[] {
    return [...this._libraries.values()].map((e) => e.manifest)
  }

  getGraph(id: string): SceneGraph | null {
    return this._libraries.get(id)?.graph ?? null
  }

  // ---------------------------------------------------------------------------
  // Content accessors
  // ---------------------------------------------------------------------------

  getComponents(libraryId?: string): Array<{ libraryId: string; node: SceneNode }> {
    const results: Array<{ libraryId: string; node: SceneNode }> = []
    for (const [id, entry] of this._libraries) {
      if (libraryId && id !== libraryId) continue
      for (const node of entry.graph.getAllNodes()) {
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          results.push({ libraryId: id, node })
        }
      }
    }
    return results
  }

  getCollections(libraryId?: string): Array<{ libraryId: string; collection: VariableCollection }> {
    const results: Array<{ libraryId: string; collection: VariableCollection }> = []
    for (const [id, entry] of this._libraries) {
      if (libraryId && id !== libraryId) continue
      for (const col of entry.graph.variableCollections.values()) {
        results.push({ libraryId: id, collection: col })
      }
    }
    return results
  }

  getStyles(libraryId?: string): Array<{ libraryId: string; style: NamedStyle }> {
    const results: Array<{ libraryId: string; style: NamedStyle }> = []
    for (const [id, entry] of this._libraries) {
      if (libraryId && id !== libraryId) continue
      for (const style of entry.graph.styles.values()) {
        results.push({ libraryId: id, style })
      }
    }
    return results
  }

  // ---------------------------------------------------------------------------
  // Graph injection / removal
  // ---------------------------------------------------------------------------

  /**
   * Inject all variable collections + styles from a library into a target graph.
   * Each injected item is tagged with `libraryId` so it can be removed later
   * and skipped during .fig export.
   */
  injectIntoGraph(libraryId: string, graph: SceneGraph): void {
    const entry = this._libraries.get(libraryId)
    if (!entry) return
    const libGraph = entry.graph

    // Inject variable collections
    for (const col of libGraph.variableCollections.values()) {
      // Skip if already injected
      if (graph.variableCollections.has(col.id)) continue
      const injectedCol: VariableCollection = { ...col, libraryId }
      graph.addCollection(injectedCol)

      // Inject variables in this collection
      for (const varId of col.variableIds) {
        const variable = libGraph.variables.get(varId)
        if (!variable || graph.variables.has(varId)) continue
        const injectedVar: Variable = { ...variable }
        graph.addVariable(injectedVar)
      }
    }

    // Inject named styles
    for (const style of libGraph.styles.values()) {
      if (graph.styles.has(style.id)) continue
      graph.addStyle({ ...style, libraryId } as NamedStyle & { libraryId: string })
    }
  }

  /**
   * Remove all variables + styles that were injected from a library.
   */
  removeFromGraph(libraryId: string, graph: SceneGraph): void {
    // Remove library styles
    for (const [id, style] of graph.styles) {
      if ((style as NamedStyle & { libraryId?: string }).libraryId === libraryId) {
        graph.removeStyle(id)
      }
    }

    // Remove library variable collections + their variables
    for (const [id, col] of graph.variableCollections) {
      if (col.libraryId === libraryId) {
        for (const varId of col.variableIds) {
          graph.removeVariable(varId)
        }
        graph.removeCollection(id)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Component copy
  // ---------------------------------------------------------------------------

  /**
   * Find a component node in `graph` that was previously copied from the given
   * library component (identified by its `libraryRef`).
   */
  findLocalComponent(libraryId: string, itemId: string, graph: SceneGraph): SceneNode | null {
    for (const node of graph.getAllNodes()) {
      if (node.libraryRef?.libraryId === libraryId && node.libraryRef.itemId === itemId) {
        return node
      }
    }
    return null
  }

  /**
   * Copy a component from the library into a target graph's internal page.
   * Returns the new local COMPONENT node, or null on failure.
   */
  copyComponentToGraph(
    libraryId: string,
    componentId: string,
    targetGraph: SceneGraph
  ): SceneNode | null {
    const entry = this._libraries.get(libraryId)
    if (!entry) return null

    const sourceNode = entry.graph.getNode(componentId)
    if (!sourceNode) return null

    // Find or create the internal-only page for library components
    const internalPage = this._ensureLibraryPage(targetGraph)

    // Clone the component tree from the library graph into the target graph
    return copyNodeTree(entry.graph, sourceNode, internalPage.id, targetGraph, {
      libraryRef: { libraryId, itemId: componentId }
    })
  }

  // ---------------------------------------------------------------------------
  // Build manifest from a graph
  // ---------------------------------------------------------------------------

  static buildManifest(id: string, name: string, graph: SceneGraph): LibraryManifest {
    let componentCount = 0
    for (const node of graph.getAllNodes()) {
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') componentCount++
    }
    return {
      id,
      name,
      addedAt: new Date().toISOString(),
      componentCount,
      variableCount: graph.variables.size,
      styleCount: graph.styles.size
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _ensureLibraryPage(graph: SceneGraph): SceneNode {
    // Look for the existing library components page
    for (const node of graph.getAllNodes()) {
      if (node.type === 'CANVAS' && node.internalOnly && node.name === '__library_components__') {
        return node
      }
    }
    // Create it
    return graph.createNode('CANVAS', graph.rootId, {
      name: '__library_components__',
      internalOnly: true
    })
  }
}

/**
 * Deep-copy a node tree from `srcGraph` into `dstGraph` under `dstParentId`.
 * Applies `rootOverrides` only to the root node.
 */
function copyNodeTree(
  srcGraph: SceneGraph,
  srcNode: SceneNode,
  dstParentId: string,
  dstGraph: SceneGraph,
  rootOverrides: Partial<SceneNode> = {}
): SceneNode {
  const { id: _id, parentId: _pid, childIds: _cids, ...rest } = srcNode
  const newNode = dstGraph.createNode(srcNode.type, dstParentId, { ...rest, ...rootOverrides })
  for (const childId of srcNode.childIds) {
    const child = srcGraph.getNode(childId)
    if (child) {
      copyNodeTree(srcGraph, child, newNode.id, dstGraph)
    }
  }
  return newNode
}

// Singleton
export const libraryRegistry = new LibraryRegistry()

export { buildPrimeReactGraph } from './primereact-graph'
export { PRIMEREACT_CONNECT_DEFS } from './primereact-connect'
export type { PrimeReactConnectDef } from './primereact-connect'
