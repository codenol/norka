export {
  IS_BROWSER,
  IS_TAURI,
  SELECTION_COLOR,
  COMPONENT_COLOR,
  SNAP_COLOR,
  CANVAS_BG_COLOR,
  SNAP_THRESHOLD,
  RULER_SIZE,
  RULER_BG_COLOR,
  RULER_TICK_COLOR,
  RULER_TEXT_COLOR,
  RULER_BADGE_HEIGHT,
  RULER_BADGE_PADDING,
  RULER_BADGE_RADIUS,
  RULER_BADGE_EXCLUSION,
  RULER_TEXT_BASELINE,
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  RULER_HIGHLIGHT_ALPHA,
  PEN_HANDLE_RADIUS,
  PEN_VERTEX_RADIUS,
  PEN_CLOSE_RADIUS_BOOST,
  PEN_PATH_STROKE_WIDTH,
  PARENT_OUTLINE_ALPHA,
  PARENT_OUTLINE_DASH,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SIZE_FONT_SIZE,
  HANDLE_HALF_SIZE,
  LABEL_OFFSET_Y,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y,
  MARQUEE_FILL_ALPHA,
  SELECTION_DASH_ALPHA,
  DROP_HIGHLIGHT_ALPHA,
  DROP_HIGHLIGHT_STROKE,
  LAYOUT_INDICATOR_STROKE,
  SECTION_CORNER_RADIUS,
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_RADIUS,
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_GAP,
  COMPONENT_SET_DASH,
  COMPONENT_SET_DASH_GAP,
  COMPONENT_SET_BORDER_WIDTH,
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  COMPONENT_LABEL_ICON_GAP,
  RULER_TARGET_PIXEL_SPACING,
  RULER_MAJOR_TOLERANCE
} from '@norka/core'

import type { Color } from '@norka/core'

export const TRYSTERO_APP_ID = 'norka'
export const ROOM_ID_LENGTH = 8
export const ROOM_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

export const PEER_COLORS: Color[] = [
  { r: 0.96, g: 0.26, b: 0.21, a: 1 },
  { r: 0.13, g: 0.59, b: 0.95, a: 1 },
  { r: 0.3, g: 0.69, b: 0.31, a: 1 },
  { r: 1.0, g: 0.76, b: 0.03, a: 1 },
  { r: 0.61, g: 0.15, b: 0.69, a: 1 },
  { r: 1.0, g: 0.34, b: 0.13, a: 1 },
  { r: 0.0, g: 0.74, b: 0.83, a: 1 },
  { r: 0.91, g: 0.12, b: 0.39, a: 1 }
]

export const YJS_JSON_FIELDS = new Set([
  'childIds',
  'fills',
  'strokes',
  'effects',
  'vectorNetwork',
  'boundVariables',
  'styleRuns'
])

export {
  DEFAULT_SHAPE_FILL,
  DEFAULT_FRAME_FILL,
  SECTION_DEFAULT_FILL,
  SECTION_DEFAULT_STROKE,
  ZOOM_DIVISOR,
  ZOOM_SCALE_MIN,
  ZOOM_SCALE_MAX
} from '@norka/core'

export const HANDLE_SIZE = 6

export const HALF_FRAC = 3 / 7
export const HUD_TOP = 12 + 32 + 6 + 32 + 12

export const SWIPE_THRESHOLD = 30
export const SWIPE_VELOCITY_THRESHOLD = 500
export const DRAWER_SPRING_STIFFNESS = 800
export const DRAWER_SPRING_DAMPING = 50

export const ACTION_TOAST_DURATION = 800
export const DRAG_DEAD_ZONE = 4
export const PEN_CLOSE_THRESHOLD = 8
export const ROTATION_SNAP_DEGREES = 15
export const CORNER_ROTATE_ZONE = 16
export const DEFAULT_TEXT_WIDTH = 200
export const DEFAULT_TEXT_HEIGHT = 24
export const AUTO_LAYOUT_BREAK_THRESHOLD = 8
export const HANDLE_HIT_RADIUS = 6

export const ACP_PERMISSION_TIMEOUT_MS = 60_000
export const ASSUMPTION_HIGHLIGHT_HEX = '#FF00A8'

const ANALYTICS_BRIEF_SECTIONS = [
  'Задача',
  'Пользователь',
  'Сценарии',
  'Состояния',
  'Ограничения',
  'Метрики',
  'Важные замечания',
  'Открытые вопросы'
].join(', ')

/** Первое пользовательское сообщение при запуске guided-сессии в режиме Аналитика */
export interface AnalyticsPromptContext {
  featureTitle: string
  screenTitle?: string
  projectTitle?: string
  screenDescription?: string
  projectDescription?: string
}

/** Первое пользовательское сообщение при запуске guided-сессии в режиме Аналитика */
export function buildAnalyticsFeatureAnalysisPrompt(context: AnalyticsPromptContext): string {
  const featureTitle = context.featureTitle.trim() || 'Без названия'
  const screenTitle = context.screenTitle?.trim() || 'Без названия'
  const projectTitle = context.projectTitle?.trim() || 'Без названия'
  const screenDescription = context.screenDescription?.trim()
  const projectDescription = context.projectDescription?.trim()
  const scopeLines = [
    `Проект: «${projectTitle}».`,
    projectDescription ? `Описание проекта: ${projectDescription}` : null,
    `Страница: «${screenTitle}».`,
    screenDescription ? `Описание страницы: ${screenDescription}` : null,
    `Фича: «${featureTitle}».`
  ].filter(Boolean)

  return [
    ...scopeLines,
    'Мы пошагово заполним бриф analytics.md для правой панели редактора.',
    `Разделы: ${ANALYTICS_BRIEF_SECTIONS}.`,
    'Веди диалог последовательно по разделам справа и не перескакивай к следующему разделу, пока текущий не прояснён.',
    'Формат каждого ответа: короткое подтверждение уже собранного факта, затем ровно один следующий конкретный вопрос.',
    'Если пользователь пишет «предложи сам» или аналогично, предложи только один рабочий вариант В РАМКАХ текущего раздела и не меняй раздел.',
    'Не переноси ответ в другой раздел только из-за того, что формулировка пользователя короткая или неполная.',
    'Если данных мало, сначала задай один вопрос, который поможет сформулировать раздел «Задача».',
    'Не пиши код, не предлагай решения интерфейса и не делай длинных сводок до завершения интервью.'
  ].join('\n')
}

/** Сообщение для продолжения guided-сессии, если история analytics уже существует */
export function buildAnalyticsContinuePrompt(): string {
  return [
    'Продолжим заполнять analytics.md по текущей истории.',
    `Проверь, какой из разделов ещё недостаточно конкретизирован: ${ANALYTICS_BRIEF_SECTIONS}.`,
    'Коротко зафиксируй, что уже ясно, и задай ровно один следующий вопрос по самому незаполненному разделу.',
    'Ответы вроде «предложи сам» трактуй как разрешение предложить вариант в текущем разделе, но не как переход в другой раздел.',
    'Если текущий раздел уже прояснён, только тогда переходи к следующему.'
  ].join('\n')
}

export const ACP_DESIGN_CONTEXT = `You are inside Nork, a design editor (like Figma). \
Use the norka MCP tools to create and modify designs on the live canvas. \
Key tools: render (JSX to design), create_shape, set_fill, set_layout, find_nodes, get_page_tree, export_image. \
The render tool accepts JSX with components: Frame, Text, Rectangle, Ellipse, Icon, Group, Section. \
Props: w, h, bg, flex, gap, p, rounded, color, size, weight, items, justify, stroke, opacity, shadow. \
Do NOT write HTML files or use terminal commands — draw directly on the canvas using the MCP tools.`
