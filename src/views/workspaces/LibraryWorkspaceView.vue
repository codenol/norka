<script setup lang="ts">
import { computed, ref } from 'vue'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport, SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { generateText } from 'ai'
import { useRoute, useRouter } from 'vue-router'

import Tip from '@/components/ui/Tip.vue'
import { toast } from '@/utils/toast'
import { createModel } from '@/composables/use-chat'
import {
  useWorkspaceFs,
  readComponentMd,
  writeComponentMd,
  exportCoreComponents,
  readCoreRuntimeManifest,
  validateCoreRuntimeManifest,
} from '@/composables/use-workspace-fs'
import { useLibraries } from '@/composables/use-libraries'
import { useProjects } from '@/composables/use-projects'

const { workspacePath, writeDesignMd } = useWorkspaceFs()

const route  = useRoute()
const router = useRouter()
const { libraries } = useLibraries()
const { products }  = useProjects()

const currentLibrary = computed(() => {
  const id = typeof route.params.id === 'string' ? route.params.id : undefined
  return id
    ? (libraries.value.find(l => l.id === id) ?? libraries.value[0] ?? null)
    : (libraries.value[0] ?? null)
})

const connectedProjects = computed(() =>
  currentLibrary.value
    ? products.value.filter(p => p.connectedLibraryIds.includes(currentLibrary.value!.id))
    : []
)

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = 'Colors' | 'Typography' | 'Effects' | 'Components' | 'Icons'
type ComponentTab = 'description' | 'props' | 'variants' | 'code' | 'rules'

interface ColorToken { id: string; name: string; value: string; group: string }
interface TypographyToken { id: string; name: string; font: string; size: string; weight: string; lineHeight: string }
interface EffectToken { id: string; name: string; description: string; value: string }
interface IconItem { id: string; name: string; icon: string }

export interface ComponentProp {
  name: string
  type: string
  default: string
  required: boolean
  description: string
}

export interface ComponentVariant {
  name: string
  description: string
  code: string
}

export interface LibraryComponent {
  id: string
  name: string
  category: 'form' | 'layout' | 'navigation' | 'display' | 'feedback'
  description: string
  primeReactImport: string
  primeReactExport: string
  color: string
  props: ComponentProp[]
  variants: ComponentVariant[]
  states: string[]
  usageExample: string
  rules: string
  usages: number
}

// ── PrimeReact Core components seed data ──────────────────────────────────────

const PRIME_CORE_COMPONENTS: LibraryComponent[] = [
  {
    id: 'btn',
    name: 'Button',
    category: 'form',
    description: 'Основная кнопка действия для первичных и вторичных взаимодействий.',
    primeReactImport: 'primereact/button',
    primeReactExport: 'Button',
    color: '#3b82f6',
    usages: 142,
    states: ['default', 'hover', 'focus', 'disabled', 'loading'],
    props: [
      { name: 'label', type: 'string', default: '', required: false, description: 'Текст кнопки' },
      { name: 'icon', type: 'string', default: '', required: false, description: 'Иконка (pi pi-*)' },
      { name: 'severity', type: 'primary|secondary|success|info|warning|danger', default: 'primary', required: false, description: 'Визуальный стиль' },
      { name: 'size', type: 'small|large', default: '', required: false, description: 'Размер' },
      { name: 'loading', type: 'boolean', default: 'false', required: false, description: 'Спиннер загрузки' },
      { name: 'disabled', type: 'boolean', default: 'false', required: false, description: 'Заблокирован' },
      { name: 'outlined', type: 'boolean', default: 'false', required: false, description: 'Только обводка' },
      { name: 'text', type: 'boolean', default: 'false', required: false, description: 'Без фона и обводки' },
    ],
    variants: [
      { name: 'primary', description: 'Главное действие на странице', code: '<Button label="Сохранить" severity="primary" />' },
      { name: 'secondary', description: 'Вторичное действие или отмена', code: '<Button label="Отмена" severity="secondary" />' },
      { name: 'danger', description: 'Деструктивное действие', code: '<Button label="Удалить" severity="danger" outlined />' },
      { name: 'loading', description: 'Состояние загрузки', code: '<Button label="Сохранение..." loading={true} />' },
    ],
    usageExample: `import { Button } from 'primereact/button'\n\n<Button label="Создать" icon="pi pi-plus" severity="primary" />\n<Button label="Отмена" severity="secondary" />\n<Button label="Удалить" severity="danger" outlined />`,
    rules: `- Максимум один primary-button на блок действий\n- Destructive-действия: severity="danger", желательно outlined\n- Кнопки-действия всегда правее кнопки отмены\n- loading=true при отправке формы — не давать кликнуть повторно\n- Не использовать icon без label, если нет Tip-подсказки`,
  },
  {
    id: 'input',
    name: 'InputText',
    category: 'form',
    description: 'Поле ввода текста для форм и поиска.',
    primeReactImport: 'primereact/inputtext',
    primeReactExport: 'InputText',
    color: '#8b5cf6',
    usages: 89,
    states: ['default', 'focus', 'filled', 'disabled', 'error'],
    props: [
      { name: 'value', type: 'string', default: '', required: false, description: 'Значение поля' },
      { name: 'placeholder', type: 'string', default: '', required: false, description: 'Плейсхолдер' },
      { name: 'disabled', type: 'boolean', default: 'false', required: false, description: 'Заблокировано' },
      { name: 'invalid', type: 'boolean', default: 'false', required: false, description: 'Состояние ошибки' },
      { name: 'size', type: 'small|large', default: '', required: false, description: 'Размер' },
    ],
    variants: [
      { name: 'default', description: 'Обычное поле', code: '<InputText placeholder="Введите текст" />' },
      { name: 'error', description: 'Поле с ошибкой', code: '<InputText invalid placeholder="Обязательное поле" />' },
    ],
    usageExample: `import { InputText } from 'primereact/inputtext'\n\n<InputText value={value} onChange={(e) => setValue(e.target.value)} placeholder="Введите текст" />`,
    rules: `- Всегда добавляй label или placeholder для accessibility\n- Состояние invalid сопровождается текстом ошибки под полем\n- Не блокируй поле без явной причины — показывай объяснение\n- Для числовых значений используй InputNumber, а не InputText`,
  },
  {
    id: 'card',
    name: 'Card',
    category: 'layout',
    description: 'Карточка-контейнер для группировки связанного контента.',
    primeReactImport: 'primereact/card',
    primeReactExport: 'Card',
    color: '#10b981',
    usages: 54,
    states: ['default', 'hover'],
    props: [
      { name: 'title', type: 'string', default: '', required: false, description: 'Заголовок карточки' },
      { name: 'subTitle', type: 'string', default: '', required: false, description: 'Подзаголовок' },
      { name: 'header', type: 'ReactNode', default: '', required: false, description: 'Header-слот (изображение и т.д.)' },
      { name: 'footer', type: 'ReactNode', default: '', required: false, description: 'Footer-слот (кнопки действий)' },
    ],
    variants: [
      { name: 'basic', description: 'Простая карточка с заголовком', code: '<Card title="Название" subTitle="Подзаголовок">\n  Контент карточки\n</Card>' },
      { name: 'with-footer', description: 'Карточка с кнопками в подвале', code: '<Card title="Название" footer={<Button label="Действие" />}>\n  Контент\n</Card>' },
    ],
    usageExample: `import { Card } from 'primereact/card'\n\n<Card title="Заголовок" subTitle="Подзаголовок">\n  Содержимое карточки\n</Card>`,
    rules: `- Используй Card для группировки логически связанного контента\n- Не вкладывай карточки друг в друга глубже одного уровня\n- Footer — только для действий, относящихся ко всей карточке\n- Избегай перегруженных карточек — выноси детали на отдельный экран`,
  },
  {
    id: 'modal',
    name: 'Dialog',
    category: 'feedback',
    description: 'Диалоговое окно для подтверждений, форм и дополнительной информации.',
    primeReactImport: 'primereact/dialog',
    primeReactExport: 'Dialog',
    color: '#f59e0b',
    usages: 31,
    states: ['closed', 'open', 'loading'],
    props: [
      { name: 'visible', type: 'boolean', default: 'false', required: true, description: 'Показать/скрыть' },
      { name: 'onHide', type: '() => void', default: '', required: true, description: 'Callback закрытия' },
      { name: 'header', type: 'string', default: '', required: false, description: 'Заголовок диалога' },
      { name: 'footer', type: 'ReactNode', default: '', required: false, description: 'Кнопки действий' },
      { name: 'modal', type: 'boolean', default: 'true', required: false, description: 'Затемнить фон' },
      { name: 'draggable', type: 'boolean', default: 'true', required: false, description: 'Можно перетаскивать' },
    ],
    variants: [
      { name: 'confirmation', description: 'Диалог подтверждения действия', code: '<Dialog visible={visible} onHide={() => setVisible(false)} header="Подтверждение">\n  Вы уверены?\n</Dialog>' },
    ],
    usageExample: `import { Dialog } from 'primereact/dialog'\n\n<Dialog visible={visible} onHide={() => setVisible(false)} header="Заголовок">\n  Содержимое\n</Dialog>`,
    rules: `- Диалог только для действий, требующих концентрации пользователя\n- Всегда добавляй кнопку закрытия или отмены\n- Заголовок обязателен — описывает суть диалога\n- Не используй диалог для простых уведомлений — используй Toast\n- Деструктивные действия: кнопка Confirm severity="danger"`,
  },
  {
    id: 'badge',
    name: 'Badge',
    category: 'display',
    description: 'Метка/бейдж для статусов, категорий и счётчиков.',
    primeReactImport: 'primereact/badge',
    primeReactExport: 'Badge',
    color: '#ef4444',
    usages: 67,
    states: ['default'],
    props: [
      { name: 'value', type: 'string|number', default: '', required: false, description: 'Значение внутри бейджа' },
      { name: 'severity', type: 'info|success|warning|danger', default: '', required: false, description: 'Цветовой стиль' },
      { name: 'size', type: 'normal|large|xlarge', default: 'normal', required: false, description: 'Размер' },
    ],
    variants: [
      { name: 'counter', description: 'Счётчик уведомлений', code: '<Badge value={5} severity="danger" />' },
      { name: 'status', description: 'Статусная метка', code: '<Badge value="Активен" severity="success" />' },
    ],
    usageExample: `import { Badge } from 'primereact/badge'\n\n<Badge value={3} severity="danger" />\n<Badge value="Новый" severity="info" />`,
    rules: `- Используй severity для смысловых статусов (success/warning/danger)\n- Счётчик > 99 отображай как "99+"\n- Не используй Badge для действий — только для информации\n- Не перегружай интерфейс Badge — только ключевые статусы`,
  },
  {
    id: 'avatar',
    name: 'Avatar',
    category: 'display',
    description: 'Аватар пользователя — фото, инициалы или иконка.',
    primeReactImport: 'primereact/avatar',
    primeReactExport: 'Avatar',
    color: '#06b6d4',
    usages: 28,
    states: ['default'],
    props: [
      { name: 'image', type: 'string', default: '', required: false, description: 'URL изображения' },
      { name: 'label', type: 'string', default: '', required: false, description: 'Инициалы (если нет фото)' },
      { name: 'icon', type: 'string', default: '', required: false, description: 'Иконка (если нет фото и инициалов)' },
      { name: 'size', type: 'normal|large|xlarge', default: 'normal', required: false, description: 'Размер' },
      { name: 'shape', type: 'square|circle', default: 'circle', required: false, description: 'Форма' },
    ],
    variants: [
      { name: 'image', description: 'Аватар с фото', code: '<Avatar image="/user.jpg" shape="circle" />' },
      { name: 'initials', description: 'Аватар с инициалами', code: '<Avatar label="АП" style={{ backgroundColor: "#3b82f6", color: "#fff" }} />' },
    ],
    usageExample: `import { Avatar } from 'primereact/avatar'\n\n<Avatar image="/user.jpg" shape="circle" size="large" />\n<Avatar label="АП" style={{ backgroundColor: '#3b82f6', color: '#fff' }} />`,
    rules: `- Приоритет: image > label > icon\n- Для списков пользователей используй AvatarGroup\n- Размер large/xlarge только в profile-секциях, не в таблицах`,
  },
  {
    id: 'tabs',
    name: 'TabView',
    category: 'navigation',
    description: 'Навигационные вкладки для переключения между секциями контента.',
    primeReactImport: 'primereact/tabview',
    primeReactExport: 'TabView',
    color: '#ec4899',
    usages: 19,
    states: ['default', 'active', 'disabled'],
    props: [
      { name: 'activeIndex', type: 'number', default: '0', required: false, description: 'Индекс активной вкладки' },
      { name: 'onTabChange', type: '(e: TabChangeEvent) => void', default: '', required: false, description: 'Callback смены вкладки' },
    ],
    variants: [
      { name: 'basic', description: 'Базовые вкладки', code: '<TabView>\n  <TabPanel header="Вкладка 1">Контент 1</TabPanel>\n  <TabPanel header="Вкладка 2">Контент 2</TabPanel>\n</TabView>' },
    ],
    usageExample: `import { TabView, TabPanel } from 'primereact/tabview'\n\n<TabView activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)}>\n  <TabPanel header="Общее">...</TabPanel>\n  <TabPanel header="Настройки">...</TabPanel>\n</TabView>`,
    rules: `- Используй TabView для переключения между связанными разделами\n- Не более 5–7 вкладок — иначе используй навигацию или Accordion\n- Активная вкладка должна быть видна без прокрутки\n- Не скрывай вкладки условно — используй disabled если нужно`,
  },
  {
    id: 'dropdown',
    name: 'Dropdown',
    category: 'form',
    description: 'Выпадающий список для выбора одного значения из набора.',
    primeReactImport: 'primereact/dropdown',
    primeReactExport: 'Dropdown',
    color: '#84cc16',
    usages: 44,
    states: ['default', 'focus', 'open', 'disabled'],
    props: [
      { name: 'value', type: 'any', default: '', required: false, description: 'Выбранное значение' },
      { name: 'options', type: 'any[]', default: '[]', required: true, description: 'Массив вариантов' },
      { name: 'onChange', type: '(e: DropdownChangeEvent) => void', default: '', required: true, description: 'Callback изменения' },
      { name: 'optionLabel', type: 'string', default: '', required: false, description: 'Поле для отображения' },
      { name: 'placeholder', type: 'string', default: '', required: false, description: 'Плейсхолдер' },
      { name: 'filter', type: 'boolean', default: 'false', required: false, description: 'Поиск по вариантам' },
      { name: 'disabled', type: 'boolean', default: 'false', required: false, description: 'Заблокирован' },
    ],
    variants: [
      { name: 'basic', description: 'Простой выпадающий список', code: '<Dropdown value={city} options={cities} onChange={(e) => setCity(e.value)} placeholder="Выберите..." />' },
      { name: 'with-filter', description: 'С поиском по значениям', code: '<Dropdown value={value} options={options} onChange={(e) => setValue(e.value)} filter placeholder="Поиск..." />' },
    ],
    usageExample: `import { Dropdown } from 'primereact/dropdown'\n\nconst options = [{ label: 'Опция 1', value: 1 }, { label: 'Опция 2', value: 2 }]\n\n<Dropdown value={value} options={options} onChange={(e) => setValue(e.value)} optionLabel="label" placeholder="Выберите..." />`,
    rules: `- При > 7 вариантах включай filter=true\n- При > 15 вариантах рассмотри AutoComplete или MultiSelect\n- Всегда задавай placeholder — он объясняет назначение поля\n- Не используй Dropdown для boolean-выборов — используй Checkbox`,
  },
]

// ── Mock data (non-component sections) ───────────────────────────────────────

const MOCK_COLORS: ColorToken[] = [
  { id: 'c1', name: 'Primary/500', value: '#3b82f6', group: 'Primary' },
  { id: 'c2', name: 'Primary/400', value: '#60a5fa', group: 'Primary' },
  { id: 'c3', name: 'Primary/600', value: '#2563eb', group: 'Primary' },
  { id: 'c4', name: 'Neutral/900', value: '#111827', group: 'Neutral' },
  { id: 'c5', name: 'Neutral/500', value: '#6b7280', group: 'Neutral' },
  { id: 'c6', name: 'Neutral/100', value: '#f3f4f6', group: 'Neutral' },
  { id: 'c7', name: 'Success/500', value: '#10b981', group: 'Semantic' },
  { id: 'c8', name: 'Error/500', value: '#ef4444', group: 'Semantic' },
  { id: 'c9', name: 'Warning/500', value: '#f59e0b', group: 'Semantic' },
]

const MOCK_TYPOGRAPHY: TypographyToken[] = [
  { id: 't1', name: 'Heading/H1', font: 'Inter', size: '32px', weight: '700', lineHeight: '40px' },
  { id: 't2', name: 'Heading/H2', font: 'Inter', size: '24px', weight: '600', lineHeight: '32px' },
  { id: 't3', name: 'Heading/H3', font: 'Inter', size: '20px', weight: '600', lineHeight: '28px' },
  { id: 't4', name: 'Body/Regular', font: 'Inter', size: '14px', weight: '400', lineHeight: '22px' },
  { id: 't5', name: 'Body/Small', font: 'Inter', size: '12px', weight: '400', lineHeight: '18px' },
  { id: 't6', name: 'Label/Medium', font: 'Inter', size: '13px', weight: '500', lineHeight: '20px' },
]

const MOCK_EFFECTS: EffectToken[] = [
  { id: 'e1', name: 'Shadow/SM', description: 'Малая тень', value: '0 1px 2px rgba(0,0,0,0.12)' },
  { id: 'e2', name: 'Shadow/MD', description: 'Средняя тень', value: '0 4px 12px rgba(0,0,0,0.18)' },
  { id: 'e3', name: 'Shadow/LG', description: 'Большая тень', value: '0 8px 24px rgba(0,0,0,0.24)' },
  { id: 'e4', name: 'Blur/Background', description: 'Размытие фона', value: 'blur(12px)' },
]

const MOCK_ICONS: IconItem[] = [
  { id: 'i1', name: 'arrow-right', icon: 'arrow-right' },
  { id: 'i2', name: 'check', icon: 'check' },
  { id: 'i3', name: 'close', icon: 'x' },
  { id: 'i4', name: 'search', icon: 'search' },
  { id: 'i5', name: 'user', icon: 'user' },
  { id: 'i6', name: 'settings', icon: 'settings' },
  { id: 'i7', name: 'bell', icon: 'bell' },
  { id: 'i8', name: 'star', icon: 'star' },
  { id: 'i9', name: 'heart', icon: 'heart' },
  { id: 'i10', name: 'home', icon: 'home' },
  { id: 'i11', name: 'mail', icon: 'mail' },
  { id: 'i12', name: 'phone', icon: 'phone' },
]

const SECTIONS: Section[] = ['Colors', 'Typography', 'Effects', 'Components', 'Icons']
const SECTION_LABELS: Record<Section, string> = {
  Colors: 'Цвета',
  Typography: 'Типографика',
  Effects: 'Эффекты',
  Components: 'Компоненты',
  Icons: 'Иконки',
}

const COMPONENT_TABS: { id: ComponentTab; label: string }[] = [
  { id: 'description', label: 'Описание' },
  { id: 'props',       label: 'Пропсы' },
  { id: 'variants',    label: 'Варианты' },
  { id: 'code',        label: 'Код' },
  { id: 'rules',       label: 'Правила' },
]

// ── Markdown serialization ─────────────────────────────────────────────────────

function componentToMd(c: LibraryComponent): string {
  const propsTable = [
    '| name | type | default | required | description |',
    '|------|------|---------|----------|-------------|',
    ...c.props.map(p => `| ${p.name} | ${p.type} | ${p.default || '—'} | ${p.required} | ${p.description} |`),
  ].join('\n')

  const variantsSection = c.variants
    .map(v => `### ${v.name}\n${v.description}\n\`\`\`tsx\n${v.code}\n\`\`\``)
    .join('\n\n')

  return [
    `# ${c.name}`,
    `category: ${c.category}`,
    `primeReact: ${c.primeReactImport}`,
    `component: ${c.primeReactExport}`,
    `color: ${c.color}`,
    '',
    `## Описание`,
    c.description,
    '',
    `## Пропсы`,
    propsTable,
    '',
    `## Варианты`,
    variantsSection,
    '',
    `## Состояния`,
    c.states.join(', '),
    '',
    `## Пример`,
    '```tsx',
    c.usageExample,
    '```',
    '',
    `## Правила`,
    c.rules,
  ].join('\n')
}

function mdToComponent(md: string, id: string): Partial<LibraryComponent> {
  const result: Partial<LibraryComponent> = { id }

  const lines = md.split('\n')
  for (const line of lines.slice(1, 10)) {
    if (line.startsWith('category:')) result.category = line.split(':')[1].trim() as LibraryComponent['category']
    if (line.startsWith('primeReact:')) result.primeReactImport = line.split(':').slice(1).join(':').trim()
    if (line.startsWith('component:')) result.primeReactExport = line.split(':').slice(1).join(':').trim()
    if (line.startsWith('color:')) result.color = line.split(':').slice(1).join(':').trim()
  }

  function extractSection(name: string): string {
    const regex = new RegExp(`## ${name}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
    const m = md.match(regex)
    return m ? m[1].trim() : ''
  }

  result.description = extractSection('Описание')
  result.rules = extractSection('Правила')

  const statesRaw = extractSection('Состояния')
  result.states = statesRaw ? statesRaw.split(',').map(s => s.trim()).filter(Boolean) : []

  const exampleMatch = md.match(/## Пример\s*\n```tsx\n([\s\S]*?)```/)
  result.usageExample = exampleMatch ? exampleMatch[1].trim() : ''

  const propsSection = extractSection('Пропсы')
  const propLines = propsSection.split('\n').filter(l => l.startsWith('|') && !l.includes('---'))
  const props: ComponentProp[] = []
  for (const line of propLines.slice(1)) {
    const cells = line.split('|').filter(Boolean).map(c => c.trim())
    if (cells.length >= 5) {
      props.push({ name: cells[0], type: cells[1], default: cells[2] === '—' ? '' : cells[2], required: cells[3] === 'true', description: cells[4] })
    }
  }
  result.props = props

  const variantsSection = extractSection('Варианты')
  const variantMatches = [...variantsSection.matchAll(/### (\w[\w-]*)\n([\s\S]*?)```tsx\n([\s\S]*?)```/g)]
  result.variants = variantMatches.map(m => ({ name: m[1], description: m[2].trim(), code: m[3].trim() }))

  return result
}

// ── State ─────────────────────────────────────────────────────────────────────

const activeSection = ref<Section>('Components')
const activeItemId = ref<string | null>('btn')
const collapsedSections = ref<Set<Section>>(new Set())
const viewMode = ref<'grid' | 'list'>('grid')
const searchQuery = ref('')
const isDirty = ref(false)
const activeComponentTab = ref<ComponentTab>('description')

// Edit state for non-component sections
const editName = ref('')
const editValue = ref('')

// Rich edit state for selected component
const editComp = ref<LibraryComponent | null>(null)

const activeItem = computed(() => {
  if (!activeItemId.value) return null
  switch (activeSection.value) {
    case 'Colors':     return MOCK_COLORS.find(c => c.id === activeItemId.value) ?? null
    case 'Typography': return MOCK_TYPOGRAPHY.find(t => t.id === activeItemId.value) ?? null
    case 'Effects':    return MOCK_EFFECTS.find(e => e.id === activeItemId.value) ?? null
    case 'Components': return PRIME_CORE_COMPONENTS.find(c => c.id === activeItemId.value) ?? null
    case 'Icons':      return MOCK_ICONS.find(i => i.id === activeItemId.value) ?? null
    default: return null
  }
})

async function loadComponent(id: string) {
  const seed = PRIME_CORE_COMPONENTS.find(c => c.id === id)
  if (!seed) return
  if (workspacePath.value) {
    try {
      const md = await readComponentMd(workspacePath.value, id)
      if (md) {
        editComp.value = { ...seed, ...mdToComponent(md, id) }
        return
      }
    } catch (error) {
      console.warn('Could not load component markdown, using seed:', error)
    }
  }
  editComp.value = { ...seed, props: [...seed.props], variants: [...seed.variants], states: [...seed.states] }
}

function selectItem(id: string) {
  activeItemId.value = id
  isDirty.value = false
  if (activeSection.value === 'Components') {
    activeComponentTab.value = 'description'
    void loadComponent(id)
  } else {
    const item = activeItem.value as unknown as Record<string, unknown>
    if (item) {
      editName.value = String(item.name ?? '')
      editValue.value = String(item.value ?? item.font ?? item.description ?? '')
    }
  }
}

function toggleSection(s: Section) {
  if (collapsedSections.value.has(s)) collapsedSections.value.delete(s)
  else collapsedSections.value.add(s)
}

function selectSection(s: Section) {
  activeSection.value = s
  activeItemId.value = null
  isDirty.value = false
}

function markDirty() {
  isDirty.value = true
}

async function saveChanges() {
  if (activeSection.value === 'Components' && editComp.value) {
    if (workspacePath.value) {
      try {
        await writeComponentMd(workspacePath.value, editComp.value.id, componentToMd(editComp.value))
        toast.success(`${editComp.value.name} сохранён`)
      } catch (e) {
        toast.error('Ошибка сохранения компонента')
        console.error(e)
      }
    } else {
      toast.info('Откройте рабочую папку для сохранения на диск')
    }
  } else {
    toast.info('Изменения сохранены')
  }
  isDirty.value = false
}

function publish() {
  toast.info('Библиотека опубликована v1.5.0')
}

// ── Export Core ───────────────────────────────────────────────────────────────

const isExportingCore = ref(false)
const runtimeStatus = ref<Record<string, { available: boolean, hasDefaults: boolean }>>({})

async function refreshRuntimeStatus() {
  if (!workspacePath.value) {
    runtimeStatus.value = {}
    return
  }
  const manifest = await readCoreRuntimeManifest(workspacePath.value)
  if (!manifest) {
    runtimeStatus.value = {}
    return
  }
  runtimeStatus.value = Object.fromEntries(
    manifest.components.map(comp => [
      comp.exportName,
      { available: true, hasDefaults: Object.keys(comp.previewDefaults ?? {}).length > 0 }
    ])
  )
}

async function exportCore() {
  if (!workspacePath.value) {
    toast.error('Откройте рабочую папку для экспорта')
    return
  }
  isExportingCore.value = true
  try {
    await exportCoreComponents(workspacePath.value, PRIME_CORE_COMPONENTS.map(c => ({
      id: c.id,
      name: c.name,
      primeReactImport: c.primeReactImport,
      primeReactExport: c.primeReactExport,
      description: c.description,
      rules: editComp.value?.id === c.id ? (editComp.value.rules ?? c.rules) : c.rules,
    })))
    const manifest = await readCoreRuntimeManifest(workspacePath.value)
    if (!manifest) {
      toast.error('Core exported, but runtime manifest is missing')
      return
    }
    const validation = validateCoreRuntimeManifest(manifest)
    if (!validation.ok) {
      toast.error(`Runtime validation failed: ${validation.errors[0] ?? 'Unknown error'}`)
      return
    }
    await refreshRuntimeStatus()
    toast.success(`Core runtime sync complete (${manifest.components.length} components)`)
  } catch (e) {
    toast.error('Ошибка экспорта')
    console.error(e)
  } finally {
    isExportingCore.value = false
  }
}

// ── DESIGN.md generation ──────────────────────────────────────────────────────

const isGeneratingDesignMd = ref(false)

async function generateDesignMd() {
  const model = createModel()
  if (!model) { toast.error('Настройте AI-провайдер в настройках'); return }
  if (!workspacePath.value) { toast.error('Откройте рабочую папку в Навигаторе проектов'); return }

  isGeneratingDesignMd.value = true
  try {
    const colorsTable = MOCK_COLORS.map(c => `| \`${c.name}\` | ${c.value} | ${c.group} |`).join('\n')
    const typographyTable = MOCK_TYPOGRAPHY.map(t => `| ${t.name} | ${t.font} | ${t.size} | ${t.weight} | ${t.lineHeight} |`).join('\n')
    const effectsTable = MOCK_EFFECTS.map(e => `| ${e.name} | ${e.description} | \`${e.value}\` |`).join('\n')
    const componentsList = PRIME_CORE_COMPONENTS.map(c => `- **${c.name}** (\`${c.primeReactImport}\`): ${c.description}`).join('\n')

    const prompt = `You are a design system expert. Generate a DESIGN.md file in the Google Stitch format with exactly 9 sections based on this design library data.

## Color Tokens
| Name | Value | Group |
|------|-------|-------|
${colorsTable}

## Typography Scale
| Name | Font | Size | Weight | Line Height |
|------|------|------|--------|-------------|
${typographyTable}

## Effects
| Name | Description | Value |
|------|-------------|-------|
${effectsTable}

## Components (PrimeReact-based)
${componentsList}

Generate a complete DESIGN.md with these 9 sections:
1. Visual Theme & Atmosphere
2. Color Palette & Roles
3. Typography Rules
4. Component Stylings
5. Layout Principles
6. Depth & Elevation
7. Do's and Don'ts
8. Responsive Behavior
9. Agent Prompt Guide

Use the actual library data provided above. Make it LLM-friendly and actionable. Write in English. Start with # DESIGN.md.`

    const { text } = await generateText({ model, prompt })
    await writeDesignMd(workspacePath.value, text)
    toast.success('DESIGN.md сохранён в рабочую папку')
  } catch (err) {
    toast.error('Ошибка генерации DESIGN.md')
    console.error(err)
  } finally {
    isGeneratingDesignMd.value = false
  }
}

const sectionCounts = computed<Record<Section, number>>(() => ({
  Colors:     MOCK_COLORS.length,
  Typography: MOCK_TYPOGRAPHY.length,
  Effects:    MOCK_EFFECTS.length,
  Components: PRIME_CORE_COMPONENTS.length,
  Icons:      MOCK_ICONS.length,
}))

const filteredColors = computed(() =>
  MOCK_COLORS.filter(c => !searchQuery.value || c.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
)
const filteredTypography = computed(() =>
  MOCK_TYPOGRAPHY.filter(t => !searchQuery.value || t.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
)
const filteredComponents = computed(() =>
  PRIME_CORE_COMPONENTS.filter(c => !searchQuery.value || c.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
)
const filteredIcons = computed(() =>
  MOCK_ICONS.filter(i => !searchQuery.value || i.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
)
const filteredEffects = computed(() =>
  MOCK_EFFECTS.filter(e => !searchQuery.value || e.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
)

// Init — load first component
void loadComponent('btn')
void refreshRuntimeStatus()
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <button
        class="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="router.push('/libraries')"
      >
        <icon-lucide-arrow-left class="size-3.5" />
      </button>
      <span class="text-sm font-medium text-surface">{{ currentLibrary?.name ?? 'Библиотека' }}</span>
      <span class="rounded border border-border px-2 py-0.5 text-[11px] font-medium text-muted">v{{ currentLibrary?.version ?? '—' }}</span>

      <button
        class="flex items-center gap-1.5 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent/80 transition-colors"
        @click="publish"
      >
        <icon-lucide-upload class="size-3.5" />
        Опубликовать
      </button>

      <div class="h-4 w-px bg-border" />

      <Tip label="Сгенерировать DESIGN.md из библиотеки (AI)" side="bottom">
        <button
          class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
          :disabled="isGeneratingDesignMd"
          @click="generateDesignMd"
        >
          <icon-lucide-sparkles v-if="!isGeneratingDesignMd" class="size-3.5" />
          <icon-lucide-loader-circle v-else class="size-3.5 animate-spin" />
          DESIGN.md
        </button>
      </Tip>

      <Tip label="Синхронизировать runtime-библиотеку core/* для AI и preview" side="bottom">
        <button
          class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
          :disabled="isExportingCore"
          @click="exportCore"
        >
          <icon-lucide-package-open v-if="!isExportingCore" class="size-3.5" />
          <icon-lucide-loader-circle v-else class="size-3.5 animate-spin" />
          Sync Runtime
        </button>
      </Tip>

      <div class="h-4 w-px bg-border" />

      <Tip label="Импортировать библиотеку">
        <button class="flex size-7 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface transition-colors">
          <icon-lucide-download class="size-4" />
        </button>
      </Tip>

      <Tip label="Экспортировать библиотеку">
        <button class="flex size-7 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface transition-colors">
          <icon-lucide-share-2 class="size-4" />
        </button>
      </Tip>

      <div class="flex-1" />

      <!-- Search -->
      <div class="flex items-center gap-1.5 rounded border border-border bg-canvas px-2 py-1 focus-within:border-accent/50 w-48">
        <icon-lucide-search class="size-3.5 shrink-0 text-muted" />
        <input
          v-model="searchQuery"
          placeholder="Поиск…"
          class="flex-1 bg-transparent text-xs text-surface outline-none placeholder:text-muted"
        />
      </div>
    </header>

    <!-- Body -->
    <SplitterGroup direction="horizontal" auto-save-id="library-layout" class="flex-1 overflow-hidden">
      <!-- Left: Tree -->
      <SplitterPanel :default-size="20" :min-size="14" :max-size="30" class="flex flex-col overflow-hidden border-r border-border bg-panel">
        <ScrollAreaRoot class="flex-1">
          <ScrollAreaViewport class="h-full py-2">
            <div
              v-for="section in SECTIONS"
              :key="section"
            >
              <!-- Section header -->
              <button
                class="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors"
                :class="activeSection === section ? 'text-surface' : 'text-muted hover:text-surface'"
                @click="selectSection(section)"
              >
                <icon-lucide-chevron-right
                  class="size-3 shrink-0 transition-transform"
                  :class="!collapsedSections.has(section) ? 'rotate-90' : ''"
                  @click.stop="toggleSection(section)"
                />
                <span class="flex-1 text-left">{{ SECTION_LABELS[section] }}</span>
                <span class="rounded bg-canvas px-1.5 py-0.5 text-[10px]">{{ sectionCounts[section] }}</span>
              </button>
            </div>

            <!-- Connected projects section -->
            <div class="mt-1 border-t border-border/60 px-3 py-2">
              <span class="text-[10px] uppercase tracking-wider text-muted">Проекты</span>
              <div v-if="!connectedProjects.length" class="mt-1.5 text-[11px] text-muted/50">
                Не подключено
              </div>
              <div
                v-for="p in connectedProjects"
                :key="p.id"
                class="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs text-surface transition-colors hover:text-accent"
                @click="router.push('/projects')"
              >
                <icon-lucide-folder class="size-3 shrink-0 text-accent/50" />
                <span class="truncate">{{ p.title }}</span>
              </div>
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Center: Content browser -->
      <SplitterPanel :default-size="55" :min-size="30" class="flex flex-col overflow-hidden bg-canvas">
        <!-- Section header + view toggle -->
        <div class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <span class="flex-1 text-xs font-medium text-surface">{{ SECTION_LABELS[activeSection] }}</span>
          <span class="text-[11px] text-muted">{{ sectionCounts[activeSection] }} элементов</span>
          <div class="flex items-center gap-0.5 rounded border border-border p-0.5">
            <button
              class="rounded p-0.5 transition-colors"
              :class="viewMode === 'grid' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
              @click="viewMode = 'grid'"
            >
              <icon-lucide-layout-grid class="size-3.5" />
            </button>
            <button
              class="rounded p-0.5 transition-colors"
              :class="viewMode === 'list' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
              @click="viewMode = 'list'"
            >
              <icon-lucide-list class="size-3.5" />
            </button>
          </div>
        </div>

        <ScrollAreaRoot class="flex-1">
          <ScrollAreaViewport class="h-full p-3">

            <!-- Colors grid -->
            <template v-if="activeSection === 'Colors'">
              <div
                :class="viewMode === 'grid'
                  ? 'grid grid-cols-3 gap-2'
                  : 'flex flex-col gap-1'"
              >
                <button
                  v-for="color in filteredColors"
                  :key="color.id"
                  class="group rounded-lg border transition-all"
                  :class="activeItemId === color.id
                    ? 'border-accent/50 bg-hover'
                    : 'border-border hover:border-border/80 hover:bg-hover/50'"
                  @click="selectItem(color.id)"
                >
                  <template v-if="viewMode === 'grid'">
                    <div class="h-12 w-full rounded-t-lg" :style="{ backgroundColor: color.value }" />
                    <div class="px-2 py-1.5 text-left">
                      <div class="truncate text-[11px] text-surface">{{ color.name.split('/')[1] }}</div>
                      <div class="text-[10px] text-muted">{{ color.value }}</div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="flex items-center gap-2.5 px-2.5 py-2">
                      <div class="size-5 shrink-0 rounded" :style="{ backgroundColor: color.value }" />
                      <span class="flex-1 text-left text-xs text-surface">{{ color.name }}</span>
                      <span class="text-[11px] text-muted">{{ color.value }}</span>
                    </div>
                  </template>
                </button>
              </div>
            </template>

            <!-- Typography table -->
            <template v-if="activeSection === 'Typography'">
              <div class="flex flex-col gap-1">
                <div class="mb-1 grid grid-cols-5 gap-2 px-2 text-[10px] uppercase tracking-wider text-muted">
                  <span>Название</span><span>Шрифт</span><span>Размер</span><span>Насыщ.</span><span>Высота</span>
                </div>
                <button
                  v-for="t in filteredTypography"
                  :key="t.id"
                  class="grid grid-cols-5 gap-2 rounded-lg border px-2 py-2 text-left transition-all"
                  :class="activeItemId === t.id
                    ? 'border-accent/50 bg-hover'
                    : 'border-transparent hover:border-border hover:bg-hover/50'"
                  @click="selectItem(t.id)"
                >
                  <span class="truncate text-xs text-surface">{{ t.name }}</span>
                  <span class="text-xs text-muted">{{ t.font }}</span>
                  <span class="text-xs text-muted">{{ t.size }}</span>
                  <span class="text-xs text-muted">{{ t.weight }}</span>
                  <span class="text-xs text-muted">{{ t.lineHeight }}</span>
                </button>
              </div>
            </template>

            <!-- Effects -->
            <template v-if="activeSection === 'Effects'">
              <div class="flex flex-col gap-2">
                <button
                  v-for="e in filteredEffects"
                  :key="e.id"
                  class="rounded-lg border p-3 text-left transition-all"
                  :class="activeItemId === e.id
                    ? 'border-accent/50 bg-hover'
                    : 'border-border hover:bg-hover/50'"
                  @click="selectItem(e.id)"
                >
                  <div class="text-xs font-medium text-surface">{{ e.name }}</div>
                  <div class="mt-0.5 text-[11px] text-muted">{{ e.description }}</div>
                  <div class="mt-1 font-mono text-[10px] text-muted/70">{{ e.value }}</div>
                </button>
              </div>
            </template>

            <!-- Components grid -->
            <template v-if="activeSection === 'Components'">
              <div
                :class="viewMode === 'grid'
                  ? 'grid grid-cols-3 gap-3'
                  : 'flex flex-col gap-1'"
              >
                <button
                  v-for="comp in filteredComponents"
                  :key="comp.id"
                  class="rounded-lg border transition-all"
                  :class="activeItemId === comp.id
                    ? 'border-accent/50 bg-hover'
                    : 'border-border hover:bg-hover/50'"
                  @click="selectItem(comp.id)"
                >
                  <template v-if="viewMode === 'grid'">
                    <div class="flex h-16 items-center justify-center rounded-t-lg bg-panel/60">
                      <div class="rounded px-4 py-2 text-xs font-medium text-white" :style="{ backgroundColor: comp.color }">
                        {{ comp.name }}
                      </div>
                    </div>
                    <div class="px-2 py-1.5 text-left">
                      <div class="flex items-center gap-1.5">
                        <div class="text-xs text-surface">{{ comp.name }}</div>
                        <span
                          class="rounded px-1 py-0.5 text-[9px]"
                          :class="runtimeStatus[comp.primeReactExport]?.available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'"
                        >
                          {{ runtimeStatus[comp.primeReactExport]?.available ? 'runtime' : 'missing' }}
                        </span>
                      </div>
                      <div class="text-[10px] text-muted">{{ comp.usages }} использований</div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="flex items-center gap-2.5 px-2.5 py-2">
                      <div class="flex size-6 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white" :style="{ backgroundColor: comp.color }">
                        {{ comp.name[0] }}
                      </div>
                      <div class="flex-1 text-left">
                        <div class="flex items-center gap-1.5">
                          <div class="text-xs text-surface">{{ comp.name }}</div>
                          <span
                            class="rounded px-1 py-0.5 text-[9px]"
                            :class="runtimeStatus[comp.primeReactExport]?.available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'"
                          >
                            {{ runtimeStatus[comp.primeReactExport]?.available ? 'runtime' : 'missing' }}
                          </span>
                        </div>
                        <div class="text-[10px] text-muted">{{ comp.description }}</div>
                      </div>
                      <span class="text-[10px] text-muted">{{ comp.usages }}</span>
                    </div>
                  </template>
                </button>
              </div>
            </template>

            <!-- Icons grid -->
            <template v-if="activeSection === 'Icons'">
              <div
                :class="viewMode === 'grid'
                  ? 'grid grid-cols-4 gap-2'
                  : 'flex flex-col gap-1'"
              >
                <button
                  v-for="ic in filteredIcons"
                  :key="ic.id"
                  class="rounded-lg border transition-all"
                  :class="activeItemId === ic.id
                    ? 'border-accent/50 bg-hover'
                    : 'border-border hover:bg-hover/50'"
                  @click="selectItem(ic.id)"
                >
                  <template v-if="viewMode === 'grid'">
                    <div class="flex flex-col items-center gap-1.5 py-3">
                      <component :is="`icon-lucide-${ic.icon}`" class="size-5 text-surface" />
                      <span class="text-[10px] text-muted">{{ ic.name }}</span>
                    </div>
                  </template>
                  <template v-else>
                    <div class="flex items-center gap-2.5 px-2.5 py-2">
                      <component :is="`icon-lucide-${ic.icon}`" class="size-4 shrink-0 text-surface" />
                      <span class="text-xs text-surface">{{ ic.name }}</span>
                    </div>
                  </template>
                </button>
              </div>
            </template>

          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Right: Edit panel -->
      <SplitterPanel :default-size="25" :min-size="18" :max-size="38" class="flex flex-col overflow-hidden border-l border-border bg-panel">
        <div v-if="!activeItem" class="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
          <icon-lucide-mouse-pointer-2 class="size-8 opacity-30" />
          <p class="text-center text-xs px-4">Выберите элемент для редактирования</p>
        </div>

        <template v-else>
          <!-- Header: item name + component tabs -->
          <header class="shrink-0 border-b border-border">
            <div class="flex items-center gap-2 px-3 py-2">
              <span class="flex-1 truncate text-xs font-medium text-surface">
                {{ activeSection === 'Components' ? editComp?.name : (activeItem as any).name }}
              </span>
              <span v-if="activeSection === 'Components' && editComp" class="text-[10px] text-muted">
                {{ editComp.primeReactImport }}
              </span>
            </div>
            <!-- Tab bar (only for Components) -->
            <div v-if="activeSection === 'Components'" class="flex items-center gap-0.5 border-t border-border/60 px-2 pb-1.5 pt-1">
              <button
                v-for="tab in COMPONENT_TABS"
                :key="tab.id"
                class="rounded px-2 py-0.5 text-[11px] transition-colors"
                :class="activeComponentTab === tab.id
                  ? 'bg-hover text-surface'
                  : 'text-muted hover:text-surface'"
                @click="activeComponentTab = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>
          </header>

          <ScrollAreaRoot class="flex-1">
            <ScrollAreaViewport class="h-full p-3">
              <div class="flex flex-col gap-3">

                <!-- Color editor -->
                <template v-if="activeSection === 'Colors'">
                  <div class="flex items-center justify-center">
                    <div class="h-20 w-full rounded-lg border border-border shadow-inner" :style="{ backgroundColor: (activeItem as ColorToken).value }" />
                  </div>
                  <div>
                    <label class="mb-1 block text-[11px] text-muted">Hex</label>
                    <input :value="(activeItem as ColorToken).value" class="w-full rounded border border-border bg-canvas px-2 py-1.5 font-mono text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                  </div>
                  <div>
                    <label class="mb-1 block text-[11px] text-muted">Название токена</label>
                    <input :value="(activeItem as ColorToken).name" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                  </div>
                  <div>
                    <label class="mb-1 block text-[11px] text-muted">Группа</label>
                    <input :value="(activeItem as ColorToken).group" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                  </div>
                </template>

                <!-- Typography editor -->
                <template v-if="activeSection === 'Typography'">
                  <div>
                    <label class="mb-1 block text-[11px] text-muted">Название</label>
                    <input :value="(activeItem as TypographyToken).name" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="mb-1 block text-[11px] text-muted">Размер</label>
                      <input :value="(activeItem as TypographyToken).size" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                    </div>
                    <div>
                      <label class="mb-1 block text-[11px] text-muted">Насыщенность</label>
                      <input :value="(activeItem as TypographyToken).weight" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                    </div>
                    <div>
                      <label class="mb-1 block text-[11px] text-muted">Шрифт</label>
                      <input :value="(activeItem as TypographyToken).font" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                    </div>
                    <div>
                      <label class="mb-1 block text-[11px] text-muted">Межстрочный</label>
                      <input :value="(activeItem as TypographyToken).lineHeight" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                    </div>
                  </div>
                </template>

                <!-- Effects editor -->
                <template v-if="activeSection === 'Effects'">
                  <div>
                    <label class="mb-1 block text-[11px] text-muted">Название</label>
                    <input :value="(activeItem as EffectToken).name" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                  </div>
                  <div>
                    <label class="mb-1 block text-[11px] text-muted">Описание</label>
                    <input :value="(activeItem as EffectToken).description" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                  </div>
                  <div>
                    <label class="mb-1 block text-[11px] text-muted">CSS значение</label>
                    <textarea :value="(activeItem as EffectToken).value" rows="2" class="w-full resize-none rounded border border-border bg-canvas px-2 py-1.5 font-mono text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                  </div>
                </template>

                <!-- Icon editor -->
                <template v-if="activeSection === 'Icons'">
                  <div class="flex items-center justify-center rounded-lg border border-border bg-canvas py-6">
                    <component :is="`icon-lucide-${(activeItem as IconItem).icon}`" class="size-10 text-surface" />
                  </div>
                  <div>
                    <label class="mb-1 block text-[11px] text-muted">Название</label>
                    <input :value="(activeItem as IconItem).name" class="w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50" @input="markDirty" />
                  </div>
                </template>

                <!-- ── Components: 5-tab editor ────────────────────────────── -->
                <template v-if="activeSection === 'Components' && editComp">

                  <!-- Tab: Описание -->
                  <template v-if="activeComponentTab === 'description'">
                    <div>
                      <label class="mb-1 block text-[11px] text-muted">Описание</label>
                      <textarea
                        v-model="editComp.description"
                        rows="3"
                        class="w-full resize-none rounded border border-border bg-canvas px-2 py-1.5 text-xs text-surface outline-none focus:border-accent/50"
                        @input="markDirty"
                      />
                    </div>
                    <div>
                      <label class="mb-1.5 block text-[11px] text-muted">Импорт PrimeReact</label>
                      <code class="block overflow-x-auto rounded bg-hover px-2 py-1.5 text-[11px] text-muted">
                        import &#123; {{ editComp.primeReactExport }} &#125; from '{{ editComp.primeReactImport }}'
                      </code>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-[11px] text-muted">Состояния</label>
                      <div class="flex flex-wrap gap-1.5">
                        <span
                          v-for="state in editComp.states"
                          :key="state"
                          class="rounded bg-accent/10 px-2 py-0.5 text-[11px] text-accent"
                        >{{ state }}</span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between rounded border border-border px-3 py-2">
                      <span class="text-xs text-muted">Использований</span>
                      <span class="text-xs font-medium text-surface">{{ editComp.usages }}</span>
                    </div>
                  </template>

                  <!-- Tab: Пропсы -->
                  <template v-else-if="activeComponentTab === 'props'">
                    <div class="overflow-hidden rounded border border-border">
                      <table class="w-full text-[11px]">
                        <thead>
                          <tr class="bg-panel/60">
                            <th class="px-2 py-1.5 text-left font-medium text-muted">name</th>
                            <th class="px-2 py-1.5 text-left font-medium text-muted">type</th>
                            <th class="px-2 py-1.5 text-left font-medium text-muted">default</th>
                            <th class="w-6 px-2 py-1.5 text-center font-medium text-muted">req</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-border">
                          <tr
                            v-for="prop in editComp.props"
                            :key="prop.name"
                            class="group hover:bg-hover/30"
                          >
                            <td class="px-2 py-1.5 font-mono text-[11px] text-accent">{{ prop.name }}</td>
                            <td class="max-w-[80px] truncate px-2 py-1.5 text-muted">{{ prop.type }}</td>
                            <td class="px-2 py-1.5 text-muted">{{ prop.default || '—' }}</td>
                            <td class="px-2 py-1.5 text-center text-accent">{{ prop.required ? '✓' : '' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p class="text-[11px] text-muted">{{ editComp.props.length }} пропсов · редактирование через Правила или сохранённый markdown</p>
                  </template>

                  <!-- Tab: Варианты -->
                  <template v-else-if="activeComponentTab === 'variants'">
                    <div
                      v-for="variant in editComp.variants"
                      :key="variant.name"
                      class="flex flex-col gap-1.5"
                    >
                      <div class="flex items-center gap-1.5">
                        <span class="rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent">{{ variant.name }}</span>
                        <span class="text-[11px] text-muted">{{ variant.description }}</span>
                      </div>
                      <pre class="overflow-x-auto rounded bg-hover px-3 py-2 text-[11px] leading-relaxed text-surface"><code>{{ variant.code }}</code></pre>
                    </div>
                  </template>

                  <!-- Tab: Код -->
                  <template v-else-if="activeComponentTab === 'code'">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] text-muted">Пример использования</span>
                      <button
                        class="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted transition-colors hover:bg-hover hover:text-surface"
                        @click="navigator.clipboard.writeText(editComp.usageExample)"
                      >
                        <icon-lucide-copy class="size-3" />
                        Копировать
                      </button>
                    </div>
                    <textarea
                      v-model="editComp.usageExample"
                      rows="10"
                      class="w-full resize-none rounded border border-border bg-canvas px-2 py-2 font-mono text-[11px] text-surface outline-none focus:border-accent/50"
                      @input="markDirty"
                    />
                  </template>

                  <!-- Tab: Правила -->
                  <template v-else-if="activeComponentTab === 'rules'">
                    <p class="rounded bg-accent/5 px-2.5 py-2 text-[11px] text-muted">
                      Эти правила читает AI при генерации аналитики, макетов и передачи. Пишите кратко и конкретно.
                    </p>
                    <textarea
                      v-model="editComp.rules"
                      rows="14"
                      placeholder="Напишите правила использования для дизайнеров и AI...&#10;&#10;Например:&#10;- Один primary-button на блок действий&#10;- loading=true при отправке форм"
                      class="w-full resize-none rounded border border-border bg-canvas px-2 py-2 text-xs leading-relaxed text-surface outline-none placeholder:text-muted/40 focus:border-accent/50"
                      @input="markDirty"
                    />
                  </template>

                </template>

              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
              <ScrollAreaThumb class="rounded-full bg-border" />
            </ScrollAreaScrollbar>
          </ScrollAreaRoot>

          <!-- Save button -->
          <div class="shrink-0 border-t border-border p-2">
            <button
              class="relative flex w-full items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors"
              :class="isDirty
                ? 'bg-accent text-white hover:bg-accent/80'
                : 'bg-hover text-muted cursor-not-allowed'"
              @click="isDirty && saveChanges()"
            >
              Сохранить изменения
              <span v-if="isDirty" class="absolute right-2.5 size-1.5 rounded-full bg-white/80" />
            </button>
          </div>
        </template>
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
