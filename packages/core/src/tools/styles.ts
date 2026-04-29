import { parseColor } from '../color'
import { generateId } from '../scene-graph'
import { defineTool } from './schema'

import type { StyleType, FillStyle, TextStyle, EffectStyle } from '../scene-graph'

export const listStyles = defineTool({
  name: 'list_styles',
  description: 'List all named styles (fill, text, effect).',
  params: {
    type: {
      type: 'string',
      description: 'Filter by style type',
      enum: ['FILL', 'TEXT', 'EFFECT']
    }
  },
  execute: (figma, args) => {
    const styles = figma.getLocalStyles(args.type as StyleType | undefined)
    return { count: styles.length, styles }
  }
})

export const getStyle = defineTool({
  name: 'get_style',
  description: 'Get a named style by ID.',
  params: {
    id: { type: 'string', description: 'Style ID', required: true }
  },
  execute: (figma, { id }) => {
    const style = figma.getStyleById(id)
    if (!style) return { error: `Style "${id}" not found` }
    return style
  }
})

export const createFillStyle = defineTool({
  name: 'create_fill_style',
  mutates: true,
  description: 'Create a new fill style with a solid color.',
  params: {
    name: { type: 'string', description: 'Style name', required: true },
    color: { type: 'color', description: 'Fill color (hex)', required: true },
    description: { type: 'string', description: 'Style description' }
  },
  execute: (figma, args) => {
    const rgba = parseColor(args.color)
    const style: FillStyle = {
      id: generateId(),
      name: args.name,
      type: 'FILL',
      description: args.description ?? '',
      fills: [
        {
          type: 'SOLID',
          color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    }
    figma.addStyle(style)
    return style
  }
})

export const createTextStyle = defineTool({
  name: 'create_text_style',
  mutates: true,
  description: 'Create a new text style.',
  params: {
    name: { type: 'string', description: 'Style name', required: true },
    font_family: { type: 'string', description: 'Font family (e.g. Inter)', required: true },
    font_size: { type: 'number', description: 'Font size in px', required: true },
    font_weight: { type: 'number', description: 'Font weight (100-900)', default: 400 },
    italic: { type: 'boolean', description: 'Italic', default: false },
    line_height: {
      type: 'number',
      description: 'Line height in px (null = auto)'
    },
    letter_spacing: { type: 'number', description: 'Letter spacing in px', default: 0 },
    description: { type: 'string', description: 'Style description' }
  },
  execute: (figma, args) => {
    const style: TextStyle = {
      id: generateId(),
      name: args.name,
      type: 'TEXT',
      description: args.description ?? '',
      fontFamily: args.font_family,
      fontSize: args.font_size,
      fontWeight: args.font_weight ?? 400,
      italic: args.italic ?? false,
      lineHeight: args.line_height ?? null,
      letterSpacing: args.letter_spacing ?? 0,
      textCase: 'ORIGINAL',
      textDecoration: 'NONE',
      fills: []
    }
    figma.addStyle(style)
    return style
  }
})

export const createEffectStyle = defineTool({
  name: 'create_effect_style',
  mutates: true,
  description: 'Create a new effect style with a drop shadow.',
  params: {
    name: { type: 'string', description: 'Style name', required: true },
    color: { type: 'color', description: 'Shadow color (hex)', required: true },
    offset_x: { type: 'number', description: 'Shadow offset X', default: 0 },
    offset_y: { type: 'number', description: 'Shadow offset Y', default: 4 },
    radius: { type: 'number', description: 'Blur radius', default: 8 },
    spread: { type: 'number', description: 'Spread', default: 0 },
    description: { type: 'string', description: 'Style description' }
  },
  execute: (figma, args) => {
    const rgba = parseColor(args.color)
    const style: EffectStyle = {
      id: generateId(),
      name: args.name,
      type: 'EFFECT',
      description: args.description ?? '',
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
          offset: { x: args.offset_x ?? 0, y: args.offset_y ?? 4 },
          radius: args.radius ?? 8,
          spread: args.spread ?? 0,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    }
    figma.addStyle(style)
    return style
  }
})

export const applyStyle = defineTool({
  name: 'apply_style',
  mutates: true,
  description: 'Apply a named style to a node (fill, text, or effect style).',
  params: {
    node_id: { type: 'string', description: 'Target node ID', required: true },
    style_id: { type: 'string', description: 'Style ID', required: true }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.node_id)
    if (!node) return { error: `Node "${args.node_id}" not found` }
    const style = figma.getStyleById(args.style_id)
    if (!style) return { error: `Style "${args.style_id}" not found` }

    if (style.type === 'FILL') {
      figma.applyFillStyle(args.node_id, args.style_id)
    } else if (style.type === 'TEXT') {
      figma.applyTextStyle(args.node_id, args.style_id)
    } else {
      figma.applyEffectStyle(args.node_id, args.style_id)
    }

    return { node_id: args.node_id, style_id: args.style_id, style_type: style.type }
  }
})

export const deleteStyle = defineTool({
  name: 'delete_style',
  mutates: true,
  description: 'Delete a named style.',
  params: {
    id: { type: 'string', description: 'Style ID', required: true }
  },
  execute: (figma, { id }) => {
    const style = figma.getStyleById(id)
    if (!style) return { error: `Style "${id}" not found` }
    figma.removeStyle(id)
    return { deleted: id }
  }
})

export const findStyles = defineTool({
  name: 'find_styles',
  description: 'Find named styles by name pattern.',
  params: {
    query: { type: 'string', description: 'Name substring (case-insensitive)', required: true },
    type: {
      type: 'string',
      description: 'Filter by type',
      enum: ['FILL', 'TEXT', 'EFFECT']
    }
  },
  execute: (figma, args) => {
    let styles = figma.getLocalStyles(args.type as StyleType | undefined)
    styles = styles.filter((s) => s.name.toLowerCase().includes(args.query.toLowerCase()))
    return { count: styles.length, styles }
  }
})
