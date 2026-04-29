/**
 * Design Token Export
 *
 * Converts Variables and NamedStyles from a SceneGraph into three standard formats:
 *   - CSS custom properties  (:root { --color-primary: #3b82f6; })
 *   - Tailwind theme config  ({ colors: { primary: '#3b82f6' } })
 *   - W3C Design Tokens JSON ({ "color": { "primary": { "$value": "#3b82f6", "$type": "color" } } })
 *
 * Library-injected items (libraryId set) are excluded — only local tokens are exported.
 */

import { colorToHex, colorToHex8 } from '../../../color'

import type {
  SceneGraph,
  VariableValue,
  Variable,
  VariableCollection,
  FillStyle,
  TextStyle,
  EffectStyle,
  Color,
  Effect
} from '../../../scene-graph'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
  return name
    .trim()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function isColor(v: VariableValue): v is Color {
  return typeof v === 'object' && 'r' in v
}

function colorToCSSToken(c: Color): string {
  return c.a >= 1 ? colorToHex(c) : colorToHex8(c)
}

function effectToBoxShadow(e: Effect): string {
  const x = Math.round(e.offset.x)
  const y = Math.round(e.offset.y)
  const inset = e.type === 'INNER_SHADOW' ? 'inset ' : ''
  return `${inset}${x}px ${y}px ${Math.round(e.radius)}px ${Math.round(e.spread)}px ${colorToHex8(e.color)}`
}

function resolveValue(
  val: VariableValue,
  graph: SceneGraph,
  seen: Set<string> = new Set()
): VariableValue | null {
  if (typeof val === 'object' && 'aliasId' in val) {
    if (seen.has(val.aliasId)) return null
    seen.add(val.aliasId)
    const target = graph.variables.get(val.aliasId)
    if (!target) return null
    const targetCol = graph.variableCollections.get(target.collectionId)
    const modeId = targetCol?.defaultModeId ?? Object.keys(target.valuesByMode)[0]
    if (!modeId) return null
    return resolveValue(target.valuesByMode[modeId], graph, seen)
  }
  return val
}

function getDefaultResolved(
  variable: Variable,
  col: VariableCollection,
  graph: SceneGraph
): VariableValue | null {
  const modes = variable.valuesByMode as Record<string, VariableValue | undefined>
  const rawValue = modes[col.defaultModeId]
  if (!rawValue) return null
  return resolveValue(rawValue, graph)
}

// ---------------------------------------------------------------------------
// CSS Variables
// ---------------------------------------------------------------------------

function cssLinesForVariable(
  variable: Variable,
  col: VariableCollection,
  graph: SceneGraph
): string[] {
  if (variable.hiddenFromPublishing) return []
  const resolved = getDefaultResolved(variable, col, graph)
  if (resolved === null) return []

  const prop = `--${toSlug(col.name)}-${toSlug(variable.name)}`
  const lines: string[] = []

  if (variable.type === 'COLOR' && isColor(resolved)) {
    lines.push(`  ${prop}: ${colorToCSSToken(resolved)};`)
  } else if (variable.type === 'FLOAT' && typeof resolved === 'number') {
    lines.push(`  ${prop}: ${resolved}px;`)
  } else if (variable.type === 'STRING' && typeof resolved === 'string') {
    lines.push(`  ${prop}: ${resolved};`)
  }

  if (lines.length > 0 && col.modes.length > 1) {
    const allModes = variable.valuesByMode as Record<string, VariableValue | undefined>
    for (const mode of col.modes) {
      if (mode.modeId === col.defaultModeId) continue
      const modeRaw = allModes[mode.modeId]
      if (!modeRaw) continue
      const modeResolved = resolveValue(modeRaw, graph)
      if (modeResolved === null) continue
      if (variable.type === 'COLOR' && isColor(modeResolved)) {
        lines.push(`  /* [${mode.name}] ${prop}: ${colorToCSSToken(modeResolved)}; */`)
      } else if (variable.type === 'FLOAT' && typeof modeResolved === 'number') {
        lines.push(`  /* [${mode.name}] ${prop}: ${modeResolved}px; */`)
      }
    }
  }

  return lines
}

function cssLinesForFillStyles(graph: SceneGraph): string[] {
  const styles = (graph.getStylesByType('FILL') as FillStyle[]).filter((s) => !s.libraryId)
  if (styles.length === 0) return []
  const lines = ['', '  /* Fill Styles */']
  for (const style of styles) {
    const solid = style.fills.find((f) => f.type === 'SOLID')
    if (!solid) continue
    lines.push(`  --style-${toSlug(style.name)}: ${colorToCSSToken(solid.color)};`)
  }
  return lines
}

function cssLinesForTextStyles(graph: SceneGraph): string[] {
  const styles = (graph.getStylesByType('TEXT') as TextStyle[]).filter((s) => !s.libraryId)
  if (styles.length === 0) return []
  const lines = ['', '  /* Text Styles */']
  for (const style of styles) {
    const slug = `--style-${toSlug(style.name)}`
    lines.push(`  ${slug}-font-family: "${style.fontFamily}";`)
    lines.push(`  ${slug}-font-size: ${style.fontSize}px;`)
    lines.push(`  ${slug}-font-weight: ${style.fontWeight};`)
    if (style.lineHeight !== null) lines.push(`  ${slug}-line-height: ${style.lineHeight}px;`)
    if (style.letterSpacing !== 0) lines.push(`  ${slug}-letter-spacing: ${style.letterSpacing}px;`)
  }
  return lines
}

function cssLinesForEffectStyles(graph: SceneGraph): string[] {
  const styles = (graph.getStylesByType('EFFECT') as EffectStyle[]).filter((s) => !s.libraryId)
  if (styles.length === 0) return []
  const lines = ['', '  /* Effect Styles */']
  for (const style of styles) {
    const shadows = style.effects.filter(
      (e) => e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW')
    )
    if (shadows.length === 0) continue
    lines.push(`  --style-${toSlug(style.name)}: ${shadows.map(effectToBoxShadow).join(', ')};`)
  }
  return lines
}

export function exportCSSVariables(graph: SceneGraph): string {
  const lines: string[] = [':root {']
  for (const col of graph.variableCollections.values()) {
    if (col.libraryId) continue
    const vars = graph.getVariablesForCollection(col.id)
    if (vars.length === 0) continue
    lines.push('', `  /* ${col.name} */`)
    for (const variable of vars) {
      lines.push(...cssLinesForVariable(variable, col, graph))
    }
  }
  lines.push(...cssLinesForFillStyles(graph))
  lines.push(...cssLinesForTextStyles(graph))
  lines.push(...cssLinesForEffectStyles(graph))
  lines.push('}')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Tailwind Theme
// ---------------------------------------------------------------------------

function tailwindVariables(
  graph: SceneGraph,
  colors: Record<string, string>,
  spacing: Record<string, string>
): void {
  for (const col of graph.variableCollections.values()) {
    if (col.libraryId) continue
    for (const variable of graph.getVariablesForCollection(col.id)) {
      if (variable.hiddenFromPublishing) continue
      const resolved = getDefaultResolved(variable, col, graph)
      if (resolved === null) continue
      const key = toSlug(`${col.name}-${variable.name}`)
      if (variable.type === 'COLOR' && isColor(resolved)) {
        colors[key] = colorToCSSToken(resolved)
      } else if (variable.type === 'FLOAT' && typeof resolved === 'number') {
        const nameLC = variable.name.toLowerCase()
        if (/spacing|gap|pad|margin|size|space/.test(nameLC)) {
          spacing[key] = `${resolved}px`
        }
      }
    }
  }
}

function tailwindStyles(
  graph: SceneGraph,
  colors: Record<string, string>,
  fontSize: Record<string, string>,
  fontFamily: Record<string, string[]>,
  boxShadow: Record<string, string>
): void {
  for (const style of graph.getStylesByType('FILL') as FillStyle[]) {
    if (style.libraryId) continue
    const solid = style.fills.find((f) => f.type === 'SOLID')
    if (solid) colors[toSlug(style.name)] = colorToCSSToken(solid.color)
  }
  for (const style of graph.getStylesByType('TEXT') as TextStyle[]) {
    if (style.libraryId) continue
    const slug = toSlug(style.name)
    fontSize[slug] = `${style.fontSize}px`
    const family = toSlug(style.fontFamily)
    if (!fontFamily[family]) fontFamily[family] = [style.fontFamily, 'sans-serif']
  }
  for (const style of graph.getStylesByType('EFFECT') as EffectStyle[]) {
    if (style.libraryId) continue
    const shadows = style.effects.filter(
      (e) => e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW')
    )
    if (shadows.length > 0)
      boxShadow[toSlug(style.name)] = shadows.map(effectToBoxShadow).join(', ')
  }
}

export function exportTailwindTheme(graph: SceneGraph): string {
  const colors: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const fontSize: Record<string, string> = {}
  const fontFamily: Record<string, string[]> = {}
  const boxShadow: Record<string, string> = {}

  tailwindVariables(graph, colors, spacing)
  tailwindStyles(graph, colors, fontSize, fontFamily, boxShadow)

  function jsonBlock(label: string, obj: Record<string, unknown>): string {
    if (Object.keys(obj).length === 0) return ''
    return `      ${label}: ${JSON.stringify(obj, null, 6).replace(/\n/g, '\n      ')},`
  }

  const sections = [
    jsonBlock('colors', colors),
    jsonBlock('spacing', spacing),
    jsonBlock('fontFamily', fontFamily),
    jsonBlock('fontSize', fontSize),
    jsonBlock('boxShadow', boxShadow)
  ].filter(Boolean)

  return [
    '/** @type {import("tailwindcss").Config} */',
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    ...sections,
    '    },',
    '  },',
    '}'
  ].join('\n')
}

// ---------------------------------------------------------------------------
// W3C Design Tokens JSON
// ---------------------------------------------------------------------------

interface TokenLeaf {
  $value: unknown
  $type: string
  $description?: string
}
interface TokenGroup {
  [key: string]: TokenLeaf | TokenGroup
}

function setNestedToken(root: TokenGroup, path: string[], token: TokenLeaf): void {
  let node: TokenGroup = root
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    if (!node[key]) node[key] = {}
    node = node[key] as TokenGroup
  }
  node[path[path.length - 1]] = token
}

function pathOf(name: string): string[] {
  return name
    .split(/[\s/\\]+/)
    .map(toSlug)
    .filter(Boolean)
}

function tokenForVariable(
  variable: Variable,
  col: VariableCollection,
  graph: SceneGraph
): TokenLeaf | null {
  if (variable.hiddenFromPublishing) return null
  const resolved = getDefaultResolved(variable, col, graph)
  if (resolved === null) return null

  let $value: unknown
  let $type: string

  if (variable.type === 'COLOR' && isColor(resolved)) {
    $value = colorToCSSToken(resolved)
    $type = 'color'
  } else if (variable.type === 'FLOAT' && typeof resolved === 'number') {
    $value = `${resolved}px`
    $type = 'dimension'
  } else if (variable.type === 'STRING' && typeof resolved === 'string') {
    $value = resolved
    $type = 'string'
  } else if (variable.type === 'BOOLEAN' && typeof resolved === 'boolean') {
    $value = resolved
    $type = 'boolean'
  } else {
    return null
  }

  const token: TokenLeaf = { $value, $type }
  if (variable.description) token.$description = variable.description
  return token
}

function tokensJSONVariables(graph: SceneGraph, root: TokenGroup): void {
  for (const col of graph.variableCollections.values()) {
    if (col.libraryId) continue
    for (const variable of graph.getVariablesForCollection(col.id)) {
      const token = tokenForVariable(variable, col, graph)
      if (!token) continue
      const path = [...pathOf(col.name), ...pathOf(variable.name)]
      setNestedToken(root, path, token)
    }
  }
}

function tokensJSONStyles(graph: SceneGraph, root: TokenGroup): void {
  for (const style of graph.getStylesByType('FILL') as FillStyle[]) {
    if (style.libraryId) continue
    const solid = style.fills.find((f) => f.type === 'SOLID')
    if (!solid) continue
    const token: TokenLeaf = { $value: colorToCSSToken(solid.color), $type: 'color' }
    if (style.description) token.$description = style.description
    setNestedToken(root, ['styles', ...pathOf(style.name)], token)
  }

  for (const style of graph.getStylesByType('TEXT') as TextStyle[]) {
    if (style.libraryId) continue
    const token: TokenLeaf = {
      $value: {
        fontFamily: style.fontFamily,
        fontSize: `${style.fontSize}px`,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight !== null ? `${style.lineHeight}px` : 'normal',
        letterSpacing: `${style.letterSpacing}px`
      },
      $type: 'typography'
    }
    if (style.description) token.$description = style.description
    setNestedToken(root, ['styles', ...pathOf(style.name)], token)
  }

  for (const style of graph.getStylesByType('EFFECT') as EffectStyle[]) {
    if (style.libraryId) continue
    const shadows = style.effects.filter(
      (e) => e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW')
    )
    if (shadows.length === 0) continue
    const token: TokenLeaf = {
      $value: shadows.map((e) => ({
        color: colorToHex8(e.color),
        offsetX: `${Math.round(e.offset.x)}px`,
        offsetY: `${Math.round(e.offset.y)}px`,
        blur: `${Math.round(e.radius)}px`,
        spread: `${Math.round(e.spread)}px`,
        inset: e.type === 'INNER_SHADOW'
      })),
      $type: 'shadow'
    }
    if (style.description) token.$description = style.description
    setNestedToken(root, ['styles', ...pathOf(style.name)], token)
  }
}

export function exportTokensJSON(graph: SceneGraph): string {
  const root: TokenGroup = {}
  tokensJSONVariables(graph, root)
  tokensJSONStyles(graph, root)
  return JSON.stringify(root, null, 2)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type TokenExportFormat = 'css' | 'tailwind' | 'tokens'

export function exportTokens(graph: SceneGraph, format: TokenExportFormat): string {
  if (format === 'css') return exportCSSVariables(graph)
  if (format === 'tailwind') return exportTailwindTheme(graph)
  return exportTokensJSON(graph)
}
