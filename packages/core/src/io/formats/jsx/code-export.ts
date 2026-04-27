/**
 * code-export — generates framework-aware component code from scene selection.
 *
 * When a node is an INSTANCE of a library component that has a Code Connect
 * entry with a non-empty `codeComponent`, it emits the real component tag
 * (e.g. `<Button variant="primary">`) along with the import. Unmapped nodes
 * fall back to the raw Береста JSX from `sceneNodeToJSX`.
 *
 * Frameworks supported:
 *   react-tsx — full TSX file with typed imports
 *   vue-sfc   — <script setup lang="ts"> + <template>
 *   html-tailwind — plain HTML with Tailwind classes (no imports)
 */

import { sceneNodeToJSX } from './export'

import type { SceneGraph, SceneNode } from '../../../scene-graph'
import type { JSXFormat } from './export'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CodeFramework = 'react-tsx' | 'vue-sfc' | 'html-tailwind'

export interface CodeConnectMapEntry {
  codeComponent: string
  importPath: string
  staticProps: Record<string, unknown>
}

export interface GeneratedCode {
  /** Full file content ready to copy */
  code: string
  /** Unique import statements needed */
  imports: Array<{ codeComponent: string; importPath: string }>
  /** Node IDs that were resolved via Code Connect */
  resolvedInstanceIds: string[]
  /** Node IDs that fell back to raw JSX */
  unresolvedInstanceIds: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStaticProp(key: string, value: unknown): string {
  if (typeof value === 'string') return `${key}="${value}"`
  if (typeof value === 'boolean') return value ? key : `${key}={false}`
  return `${key}={${JSON.stringify(value)}}`
}

function resolveInstance(
  node: SceneNode,
  codeMap: Record<string, CodeConnectMapEntry>
): CodeConnectMapEntry | null {
  // INSTANCE nodes have componentId pointing to the COMPONENT source
  const componentId = node.componentId
  if (!componentId) return null
  // Cast to allow runtime-undefined index access (TS Record always returns T, not T|undefined)
  const entry = (codeMap as Record<string, CodeConnectMapEntry | undefined>)[componentId]
  if (!entry) return null
  if (!entry.codeComponent) return null
  return entry
}

function emitInstanceCode(
  node: SceneNode,
  entry: CodeConnectMapEntry,
  indent: number
): string {
  const prefix = '  '.repeat(indent)
  const tag = entry.codeComponent
  const propParts = Object.entries(entry.staticProps).map(([k, v]) => formatStaticProp(k, v))
  const attrsStr = propParts.length > 0 ? ` ${propParts.join(' ')}` : ''
  return `${prefix}<${tag}${attrsStr} />`
}

function emitFallbackCode(
  nodeId: string,
  graph: SceneGraph,
  indent: number,
  framework: CodeFramework
): string {
  const jsxFormat: JSXFormat = framework === 'html-tailwind' ? 'tailwind' : 'norka'
  const raw = sceneNodeToJSX(nodeId, graph, jsxFormat)
  // Indent the raw JSX lines
  const pad = '  '.repeat(indent)
  return raw.split('\n').map((line) => `${pad}${line}`).join('\n')
}

interface NodeCodeResult {
  jsx: string
  resolved: boolean
}

function nodeToCode(
  nodeId: string,
  graph: SceneGraph,
  codeMap: Record<string, CodeConnectMapEntry>,
  framework: CodeFramework,
  indent: number
): NodeCodeResult {
  const node = graph.getNode(nodeId)
  if (!node) return { jsx: '', resolved: false }

  const entry = node.type === 'INSTANCE' ? resolveInstance(node, codeMap) : null

  if (entry) {
    return { jsx: emitInstanceCode(node, entry, indent), resolved: true }
  }

  return { jsx: emitFallbackCode(nodeId, graph, indent, framework), resolved: false }
}

function buildImportBlock(
  imports: Array<{ codeComponent: string; importPath: string }>,
  framework: CodeFramework
): string {
  if (framework === 'html-tailwind' || imports.length === 0) return ''

  // Group by importPath
  const grouped = new Map<string, string[]>()
  for (const { codeComponent, importPath } of imports) {
    const existing = grouped.get(importPath) ?? []
    if (!existing.includes(codeComponent)) existing.push(codeComponent)
    grouped.set(importPath, existing)
  }

  return [...grouped.entries()]
    .map(([path, components]) => `import { ${components.join(', ')} } from '${path}'`)
    .join('\n')
}

function wrapInFramework(
  bodyLines: string[],
  imports: Array<{ codeComponent: string; importPath: string }>,
  framework: CodeFramework
): string {
  const importBlock = buildImportBlock(imports, framework)
  const body = bodyLines.join('\n')

  if (framework === 'react-tsx') {
    const componentBody = bodyLines.length === 1 ? body : `(\n${body}\n  )`
    return [
      importBlock,
      '',
      'export default function Component() {',
      `  return ${componentBody}`,
      '}',
    ].filter(Boolean).join('\n')
  }

  if (framework === 'vue-sfc') {
    const scriptBlock = importBlock
      ? `<script setup lang="ts">\n${importBlock}\n</script>\n`
      : ''
    return [
      scriptBlock,
      '<template>',
      body,
      '</template>',
    ].filter(Boolean).join('\n')
  }

  // html-tailwind — no wrapper, no imports
  return body
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate code for the given node IDs using the Code Connect map.
 */
export function selectionToCode(
  nodeIds: string[],
  graph: SceneGraph,
  codeMap: Record<string, CodeConnectMapEntry>,
  framework: CodeFramework
): GeneratedCode {
  const resolvedInstanceIds: string[] = []
  const unresolvedInstanceIds: string[] = []
  const importsMap = new Map<string, { codeComponent: string; importPath: string }>()
  const bodyLines: string[] = []

  for (const id of nodeIds) {
    const { jsx, resolved } = nodeToCode(id, graph, codeMap, framework, framework === 'vue-sfc' ? 1 : 1)

    if (!jsx) continue

    if (resolved) {
      resolvedInstanceIds.push(id)
      // Collect import
      const node = graph.getNode(id)
      const componentId = node?.componentId ?? null
      const entry = componentId ? (codeMap[componentId] ?? null) : null
      if (entry?.importPath) {
        const key = `${entry.codeComponent}:${entry.importPath}`
        if (!importsMap.has(key)) {
          importsMap.set(key, { codeComponent: entry.codeComponent, importPath: entry.importPath })
        }
      }
    } else {
      unresolvedInstanceIds.push(id)
    }

    bodyLines.push(jsx)
  }

  const imports = [...importsMap.values()]
  const code = wrapInFramework(bodyLines, imports, framework)

  return { code, imports, resolvedInstanceIds, unresolvedInstanceIds }
}
