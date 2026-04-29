/**
 * buildPrimeReactGraph — creates a SceneGraph containing visual COMPONENT
 * representations of PrimeReact UI library components.
 *
 * All COMPONENT root nodes use stable, deterministic IDs (e.g. 'builtin-pr:Button')
 * so Code Connect entries saved to localStorage remain valid across app restarts.
 */

import { SceneGraph } from '../scene-graph'

import type { Fill, Stroke } from '../scene-graph'

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function solid(r: number, g: number, b: number, a = 1): Fill[] {
  return [{ type: 'SOLID', color: { r, g, b, a }, opacity: 1, visible: true }]
}

function solidStroke(r: number, g: number, b: number, weight = 1): Stroke[] {
  return [
    {
      color: { r, g, b, a: 1 },
      opacity: 1,
      visible: true,
      align: 'INSIDE',
      weight
    }
  ]
}

// PrimeReact Lara Light Blue theme palette
const BLUE = solid(0.247, 0.475, 0.957) // #3F79F4
const BLUE_LT = solid(0.898, 0.922, 1.0) // #E5EBff
const WHITE = solid(1, 1, 1)
const GRAY_BG = solid(0.969, 0.973, 0.976) // #F7F8F9
const GRAY_TXT = solid(0.459, 0.502, 0.549) // #757D8B
const DARK_TXT = solid(0.18, 0.22, 0.26) // #2e3842
const BORDER_C = solidStroke(0.831, 0.859, 0.886) // #D4DBDF

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

export function buildPrimeReactGraph(): SceneGraph {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id

  // ------------------------------------------------------------------
  // Button
  // ------------------------------------------------------------------
  const btn = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Button',
    name: 'Button',
    width: 120,
    height: 40,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    cornerRadius: 6,
    fills: BLUE
  })
  graph.createNode('TEXT', btn.id, {
    name: 'label',
    text: 'Button',
    fontSize: 14,
    fontWeight: 600,
    fills: WHITE,
    layoutGrow: 0,
    textAlignHorizontal: 'CENTER'
  })

  // ------------------------------------------------------------------
  // InputText
  // ------------------------------------------------------------------
  const inp = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:InputText',
    name: 'InputText',
    width: 200,
    height: 40,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'CENTER',
    paddingLeft: 12,
    paddingRight: 12,
    cornerRadius: 4,
    fills: WHITE,
    strokes: BORDER_C
  })
  graph.createNode('TEXT', inp.id, {
    name: 'placeholder',
    text: 'Placeholder...',
    fontSize: 14,
    fills: GRAY_TXT
  })

  // ------------------------------------------------------------------
  // Dropdown
  // ------------------------------------------------------------------
  const ddp = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Dropdown',
    name: 'Dropdown',
    width: 200,
    height: 40,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    paddingLeft: 12,
    paddingRight: 12,
    cornerRadius: 4,
    fills: WHITE,
    strokes: BORDER_C
  })
  graph.createNode('TEXT', ddp.id, { name: 'label', text: 'Select', fontSize: 14, fills: GRAY_TXT })
  graph.createNode('RECTANGLE', ddp.id, { name: 'chevron', width: 12, height: 8, fills: GRAY_TXT })

  // ------------------------------------------------------------------
  // DataTable
  // ------------------------------------------------------------------
  const dt = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:DataTable',
    name: 'DataTable',
    width: 600,
    height: 200,
    layoutMode: 'VERTICAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'STRETCH',
    fills: WHITE,
    strokes: BORDER_C,
    cornerRadius: 4
  })
  // Header row
  const dtHead = graph.createNode('FRAME', dt.id, {
    name: 'header',
    width: 600,
    height: 44,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'CENTER',
    paddingLeft: 16,
    paddingRight: 16,
    fills: GRAY_BG,
    layoutGrow: 0,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  for (const col of ['ID', 'Name', 'Status', 'Date']) {
    graph.createNode('TEXT', dtHead.id, {
      name: col,
      text: col,
      fontSize: 12,
      fontWeight: 600,
      fills: DARK_TXT,
      layoutGrow: 1
    })
  }
  // Data rows
  for (let r = 1; r <= 3; r++) {
    const row = graph.createNode('FRAME', dt.id, {
      name: `row-${r}`,
      width: 600,
      height: 44,
      layoutMode: 'HORIZONTAL',
      primaryAxisAlign: 'MIN',
      counterAxisAlign: 'CENTER',
      paddingLeft: 16,
      paddingRight: 16,
      fills: WHITE,
      layoutGrow: 0,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      strokes: [
        {
          color: { r: 0.831, g: 0.859, b: 0.886, a: 1 },
          opacity: 1,
          visible: true,
          align: 'INSIDE' as const,
          weight: 1
        }
      ]
    })
    for (const val of [`${r}`, `Item ${r}`, 'Active', '2024-01-0' + r]) {
      graph.createNode('TEXT', row.id, {
        name: val,
        text: val,
        fontSize: 13,
        fills: DARK_TXT,
        layoutGrow: 1
      })
    }
  }

  // ------------------------------------------------------------------
  // Card
  // ------------------------------------------------------------------
  const card = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Card',
    name: 'Card',
    width: 300,
    height: 160,
    layoutMode: 'VERTICAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'STRETCH',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    itemSpacing: 8,
    cornerRadius: 8,
    fills: WHITE,
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.08 },
        offset: { x: 0, y: 2 },
        radius: 12,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
  })
  graph.createNode('TEXT', card.id, {
    name: 'title',
    text: 'Card Title',
    fontSize: 16,
    fontWeight: 700,
    fills: DARK_TXT
  })
  graph.createNode('TEXT', card.id, {
    name: 'content',
    text: 'Card content goes here.',
    fontSize: 14,
    fills: GRAY_TXT
  })

  // ------------------------------------------------------------------
  // Dialog
  // ------------------------------------------------------------------
  const dlg = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Dialog',
    name: 'Dialog',
    width: 400,
    height: 260,
    layoutMode: 'VERTICAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'STRETCH',
    cornerRadius: 8,
    fills: WHITE,
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.18 },
        offset: { x: 0, y: 8 },
        radius: 30,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
  })
  const dlgHead = graph.createNode('FRAME', dlg.id, {
    name: 'header',
    height: 56,
    width: 400,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    paddingLeft: 20,
    paddingRight: 20,
    fills: WHITE,
    strokes: [
      {
        color: { r: 0.831, g: 0.859, b: 0.886, a: 1 },
        opacity: 1,
        visible: true,
        align: 'INSIDE' as const,
        weight: 1
      }
    ],
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  graph.createNode('TEXT', dlgHead.id, {
    name: 'title',
    text: 'Dialog',
    fontSize: 16,
    fontWeight: 700,
    fills: DARK_TXT
  })
  graph.createNode('RECTANGLE', dlgHead.id, {
    name: 'close',
    width: 20,
    height: 20,
    cornerRadius: 4,
    fills: GRAY_TXT
  })
  graph.createNode('FRAME', dlg.id, {
    name: 'content',
    width: 400,
    height: 140,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 16,
    paddingBottom: 16,
    fills: WHITE,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    layoutGrow: 1
  })
  const dlgFoot = graph.createNode('FRAME', dlg.id, {
    name: 'footer',
    height: 64,
    width: 400,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'MAX',
    counterAxisAlign: 'CENTER',
    paddingLeft: 20,
    paddingRight: 20,
    itemSpacing: 8,
    fills: WHITE,
    strokes: [
      {
        color: { r: 0.831, g: 0.859, b: 0.886, a: 1 },
        opacity: 1,
        visible: true,
        align: 'INSIDE' as const,
        weight: 1
      }
    ],
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  graph.createNode('FRAME', dlgFoot.id, {
    name: 'cancel-btn',
    width: 80,
    height: 36,
    cornerRadius: 6,
    fills: GRAY_BG
  })
  graph.createNode('FRAME', dlgFoot.id, {
    name: 'ok-btn',
    width: 80,
    height: 36,
    cornerRadius: 6,
    fills: BLUE
  })

  // ------------------------------------------------------------------
  // Panel
  // ------------------------------------------------------------------
  const panel = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Panel',
    name: 'Panel',
    width: 400,
    height: 180,
    layoutMode: 'VERTICAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'STRETCH',
    cornerRadius: 4,
    fills: WHITE,
    strokes: BORDER_C
  })
  const panelHead = graph.createNode('FRAME', panel.id, {
    name: 'header',
    width: 400,
    height: 48,
    layoutMode: 'HORIZONTAL',
    counterAxisAlign: 'CENTER',
    paddingLeft: 16,
    paddingRight: 16,
    fills: GRAY_BG,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    strokes: [
      {
        color: { r: 0.831, g: 0.859, b: 0.886, a: 1 },
        opacity: 1,
        visible: true,
        align: 'INSIDE' as const,
        weight: 1
      }
    ]
  })
  graph.createNode('TEXT', panelHead.id, {
    name: 'title',
    text: 'Panel',
    fontSize: 14,
    fontWeight: 700,
    fills: DARK_TXT
  })
  graph.createNode('FRAME', panel.id, {
    name: 'content',
    width: 400,
    height: 132,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 16,
    fills: WHITE,
    layoutGrow: 1,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })

  // ------------------------------------------------------------------
  // Tag
  // ------------------------------------------------------------------
  const tag = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Tag',
    name: 'Tag',
    width: 72,
    height: 24,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingLeft: 10,
    paddingRight: 10,
    cornerRadius: 12,
    fills: BLUE
  })
  graph.createNode('TEXT', tag.id, {
    name: 'value',
    text: 'Tag',
    fontSize: 11,
    fontWeight: 600,
    fills: WHITE
  })

  // ------------------------------------------------------------------
  // Badge
  // ------------------------------------------------------------------
  const badge = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Badge',
    name: 'Badge',
    width: 24,
    height: 24,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    cornerRadius: 12,
    fills: BLUE
  })
  graph.createNode('TEXT', badge.id, {
    name: 'value',
    text: '3',
    fontSize: 11,
    fontWeight: 700,
    fills: WHITE
  })

  // ------------------------------------------------------------------
  // ProgressBar
  // ------------------------------------------------------------------
  const pb = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:ProgressBar',
    name: 'ProgressBar',
    width: 300,
    height: 20,
    cornerRadius: 10,
    fills: GRAY_BG
  })
  graph.createNode('RECTANGLE', pb.id, {
    name: 'fill',
    x: 0,
    y: 0,
    width: 150,
    height: 20,
    cornerRadius: 10,
    fills: BLUE
  })

  // ------------------------------------------------------------------
  // Toolbar
  // ------------------------------------------------------------------
  const tb = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Toolbar',
    name: 'Toolbar',
    width: 600,
    height: 50,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    paddingLeft: 16,
    paddingRight: 16,
    fills: WHITE,
    strokes: BORDER_C
  })
  const tbLeft = graph.createNode('FRAME', tb.id, {
    name: 'left',
    width: 160,
    height: 36,
    layoutMode: 'HORIZONTAL',
    counterAxisAlign: 'CENTER',
    itemSpacing: 8,
    fills: [],
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  graph.createNode('RECTANGLE', tbLeft.id, {
    name: 'btn1',
    width: 60,
    height: 32,
    cornerRadius: 4,
    fills: BLUE
  })
  graph.createNode('RECTANGLE', tbLeft.id, {
    name: 'btn2',
    width: 60,
    height: 32,
    cornerRadius: 4,
    fills: GRAY_BG
  })
  graph.createNode('FRAME', tb.id, {
    name: 'right',
    width: 80,
    height: 36,
    layoutMode: 'HORIZONTAL',
    counterAxisAlign: 'CENTER',
    fills: [],
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })

  // ------------------------------------------------------------------
  // Breadcrumb
  // ------------------------------------------------------------------
  const bc = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Breadcrumb',
    name: 'Breadcrumb',
    width: 300,
    height: 32,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'CENTER',
    itemSpacing: 6,
    fills: []
  })
  for (const [i, label] of [
    ['0', 'Home'],
    ['1', '/'],
    ['2', 'Section'],
    ['3', '/'],
    ['4', 'Page']
  ] as [string, string][]) {
    graph.createNode('TEXT', bc.id, {
      name: `crumb-${i}`,
      text: label,
      fontSize: 13,
      fills: i === '4' ? DARK_TXT : GRAY_TXT
    })
  }

  // ------------------------------------------------------------------
  // InputNumber
  // ------------------------------------------------------------------
  const inpNum = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:InputNumber',
    name: 'InputNumber',
    width: 200,
    height: 40,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    cornerRadius: 4,
    fills: WHITE,
    strokes: BORDER_C
  })
  graph.createNode('RECTANGLE', inpNum.id, { name: 'dec', width: 32, height: 40, fills: GRAY_BG })
  graph.createNode('TEXT', inpNum.id, { name: 'value', text: '0', fontSize: 14, fills: DARK_TXT })
  graph.createNode('RECTANGLE', inpNum.id, { name: 'inc', width: 32, height: 40, fills: GRAY_BG })

  // ------------------------------------------------------------------
  // Calendar
  // ------------------------------------------------------------------
  const cal = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Calendar',
    name: 'Calendar',
    width: 200,
    height: 40,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    paddingLeft: 12,
    paddingRight: 12,
    cornerRadius: 4,
    fills: WHITE,
    strokes: BORDER_C
  })
  graph.createNode('TEXT', cal.id, {
    name: 'date',
    text: 'Select Date',
    fontSize: 14,
    fills: GRAY_TXT
  })
  graph.createNode('RECTANGLE', cal.id, {
    name: 'icon',
    width: 16,
    height: 16,
    cornerRadius: 2,
    fills: GRAY_TXT
  })

  // ------------------------------------------------------------------
  // Checkbox
  // ------------------------------------------------------------------
  const cb = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Checkbox',
    name: 'Checkbox',
    width: 20,
    height: 20,
    cornerRadius: 4,
    fills: WHITE,
    strokes: BORDER_C
  })
  graph.createNode('RECTANGLE', cb.id, {
    name: 'check',
    x: 4,
    y: 4,
    width: 12,
    height: 12,
    cornerRadius: 2,
    fills: BLUE
  })

  // ------------------------------------------------------------------
  // RadioButton
  // ------------------------------------------------------------------
  const rb = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:RadioButton',
    name: 'RadioButton',
    width: 20,
    height: 20,
    cornerRadius: 10,
    fills: WHITE,
    strokes: BORDER_C
  })
  graph.createNode('ELLIPSE', rb.id, {
    name: 'dot',
    x: 5,
    y: 5,
    width: 10,
    height: 10,
    fills: BLUE
  })

  // ------------------------------------------------------------------
  // Slider
  // ------------------------------------------------------------------
  const sl = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Slider',
    name: 'Slider',
    width: 200,
    height: 20,
    fills: []
  })
  graph.createNode('RECTANGLE', sl.id, {
    name: 'track',
    x: 0,
    y: 8,
    width: 200,
    height: 4,
    cornerRadius: 2,
    fills: GRAY_BG
  })
  graph.createNode('RECTANGLE', sl.id, {
    name: 'fill',
    x: 0,
    y: 8,
    width: 100,
    height: 4,
    cornerRadius: 2,
    fills: BLUE
  })
  graph.createNode('ELLIPSE', sl.id, {
    name: 'thumb',
    x: 92,
    y: 2,
    width: 16,
    height: 16,
    fills: WHITE,
    strokes: [
      {
        color: { r: 0.247, g: 0.475, b: 0.957, a: 1 },
        opacity: 1,
        visible: true,
        align: 'CENTER' as const,
        weight: 2
      }
    ]
  })

  // ------------------------------------------------------------------
  // TabView
  // ------------------------------------------------------------------
  const tv = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:TabView',
    name: 'TabView',
    width: 600,
    height: 280,
    layoutMode: 'VERTICAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'STRETCH',
    fills: WHITE,
    cornerRadius: 4,
    strokes: BORDER_C
  })
  const tvTabs = graph.createNode('FRAME', tv.id, {
    name: 'tabs',
    width: 600,
    height: 44,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'STRETCH',
    fills: GRAY_BG,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    strokes: [
      {
        color: { r: 0.831, g: 0.859, b: 0.886, a: 1 },
        opacity: 1,
        visible: true,
        align: 'INSIDE' as const,
        weight: 1
      }
    ]
  })
  const tab1 = graph.createNode('FRAME', tvTabs.id, {
    name: 'tab-1',
    width: 120,
    height: 44,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    fills: WHITE,
    strokes: [
      {
        color: { r: 0.247, g: 0.475, b: 0.957, a: 1 },
        opacity: 1,
        visible: true,
        align: 'INSIDE' as const,
        weight: 2
      }
    ],
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  graph.createNode('TEXT', tab1.id, {
    name: 'label',
    text: 'Tab 1',
    fontSize: 13,
    fontWeight: 600,
    fills: BLUE
  })
  const tab2 = graph.createNode('FRAME', tvTabs.id, {
    name: 'tab-2',
    width: 120,
    height: 44,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    fills: GRAY_BG,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  graph.createNode('TEXT', tab2.id, { name: 'label', text: 'Tab 2', fontSize: 13, fills: GRAY_TXT })
  graph.createNode('FRAME', tv.id, {
    name: 'content',
    width: 600,
    height: 236,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 16,
    fills: WHITE,
    layoutGrow: 1,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })

  // ------------------------------------------------------------------
  // Message
  // ------------------------------------------------------------------
  const msg = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Message',
    name: 'Message',
    width: 400,
    height: 52,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'CENTER',
    paddingLeft: 16,
    paddingRight: 16,
    itemSpacing: 10,
    cornerRadius: 6,
    fills: BLUE_LT,
    strokes: [
      {
        color: { r: 0.247, g: 0.475, b: 0.957, a: 0.3 },
        opacity: 1,
        visible: true,
        align: 'INSIDE' as const,
        weight: 1
      }
    ]
  })
  graph.createNode('ELLIPSE', msg.id, { name: 'icon', width: 20, height: 20, fills: BLUE })
  graph.createNode('TEXT', msg.id, {
    name: 'text',
    text: 'This is an info message.',
    fontSize: 13,
    fills: DARK_TXT
  })

  // ------------------------------------------------------------------
  // Divider
  // ------------------------------------------------------------------
  graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Divider',
    name: 'Divider',
    width: 400,
    height: 1,
    fills: GRAY_BG,
    strokes: BORDER_C
  })

  // ------------------------------------------------------------------
  // Avatar
  // ------------------------------------------------------------------
  const avatar = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:Avatar',
    name: 'Avatar',
    width: 40,
    height: 40,
    cornerRadius: 20,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    fills: BLUE
  })
  graph.createNode('TEXT', avatar.id, {
    name: 'label',
    text: 'A',
    fontSize: 14,
    fontWeight: 700,
    fills: WHITE
  })

  // ------------------------------------------------------------------
  // InputTextarea
  // ------------------------------------------------------------------
  const inputTextarea = graph.createNode('COMPONENT', pageId, {
    id: 'builtin-pr:InputTextarea',
    name: 'InputTextarea',
    width: 260,
    height: 96,
    cornerRadius: 4,
    fills: WHITE,
    strokes: BORDER_C
  })
  graph.createNode('TEXT', inputTextarea.id, {
    name: 'placeholder',
    text: 'Type details...',
    fontSize: 13,
    fills: GRAY_TXT
  })

  return graph
}
