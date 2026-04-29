import { computed, ref, watch } from 'vue'

import { migrateLegacyLocalStorageValue } from '@/utils/local-storage'

import {
  workspacePath,
  readNorkaJson,
  writeNorkaJson,
  ensureWorkspaceStructure
} from './use-workspace-fs'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineStep = 'analytics' | 'design' | 'discussion' | 'handoff'

export const PIPELINE_STEPS: { key: PipelineStep; label: string; index: number }[] = [
  { key: 'analytics', label: 'Аналитика', index: 0 },
  { key: 'design', label: 'Прототип', index: 1 },
  { key: 'discussion', label: 'Обсуждение', index: 2 },
  { key: 'handoff', label: 'Передача', index: 3 }
]

export interface Feature {
  id: string
  title: string
  completedSteps: PipelineStep[]
  jiraIssueKey?: string
  jiraUrl?: string
  designerFullName?: string
  confluenceUrl?: string
}

export interface Screen {
  id: string
  title: string
  features: Feature[]
}

export interface Product {
  id: string
  title: string
  screens: Screen[]
  connectedLibraryIds: string[]
}

export interface ProjectContext {
  productId: string
  screenId: string
  featureId: string
}

// ── Singleton state ────────────────────────────────────────────────────────────

const LS_PRODUCTS = 'norka:products'
const LS_CONTEXT = 'norka:context'
const LEGACY_PRODUCTS_KEYS = ['bereста:products']
const LEGACY_CONTEXT_KEYS = ['bereста:context']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function loadProducts(): Product[] {
  try {
    const raw = migrateLegacyLocalStorageValue(LS_PRODUCTS, LEGACY_PRODUCTS_KEYS)
    if (!raw) return defaultProducts()
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(migrateProduct) : defaultProducts()
  } catch {
    return defaultProducts()
  }
}

function loadContext(): ProjectContext | null {
  try {
    const raw = migrateLegacyLocalStorageValue(LS_CONTEXT, LEGACY_CONTEXT_KEYS)
    return raw ? (JSON.parse(raw) as ProjectContext) : null
  } catch {
    return null
  }
}

function migrateProduct(p: unknown): Product {
  const data = isRecord(p) ? p : {}
  const id = typeof data.id === 'string' ? data.id : `p-${crypto.randomUUID()}`
  const rawTitle = typeof data.title === 'string' ? data.title : 'Новый продукт'
  const title = id === 'p2' && rawTitle === 'Веб-дашборд' ? 'Геном 2.0' : rawTitle
  const screens = Array.isArray(data.screens)
    ? (data.screens as Screen[]).map((screen) => ({
        ...screen,
        title:
          id === 'p2' && screen.id === 's3' && screen.title === 'Главная'
            ? 'Отчёт о прошивках'
            : screen.title,
        features: Array.isArray(screen.features)
          ? screen.features.map((feature) => ({
              ...feature,
              title:
                id === 'p2' && screen.id === 's3' && feature.id === 'f6' && feature.title === 'Метрики DAU/MAU'
                  ? 'Отчёт о прошивках'
                  : id === 'p2' &&
                      screen.id === 's3' &&
                      feature.id === 'f7' &&
                      feature.title === 'Когортный retention'
                    ? 'Ролевая модель и токены доступа'
                    : feature.title,
              jiraIssueKey:
                id === 'p2' && screen.id === 's3' && feature.id === 'f6'
                  ? 'GEN-201'
                  : id === 'p2' && screen.id === 's3' && feature.id === 'f7'
                    ? 'GEN-202'
                    : feature.jiraIssueKey,
              completedSteps: sanitizeCompletedSteps(feature.completedSteps)
            }))
          : []
      }))
    : []
  const connectedLibraryIds = Array.isArray(data.connectedLibraryIds)
    ? data.connectedLibraryIds.filter((id): id is string => typeof id === 'string')
    : []
  return {
    id,
    title,
    screens,
    connectedLibraryIds
  }
}

function sanitizeCompletedSteps(steps: unknown): PipelineStep[] {
  if (!Array.isArray(steps)) return []
  // Hard migration: collapse old preview into design and drop unknown values.
  const mapped = steps.map((step) => (step === 'preview' ? 'design' : step))
  return mapped.filter(
    (step): step is PipelineStep =>
      step === 'analytics' || step === 'design' || step === 'discussion' || step === 'handoff'
  )
}

function defaultProducts(): Product[] {
  return [
    {
      id: 'p1',
      title: 'Мобильное приложение',
      connectedLibraryIds: ['lib-core', 'lib-mobile'],
      screens: [
        {
          id: 's1',
          title: 'Каталог',
          features: [
            {
              id: 'f1',
              title: 'Карточка товара',
              completedSteps: ['analytics', 'design'],
              jiraIssueKey: 'APP-101',
              jiraUrl: 'https://jira.example.com/browse/APP-101',
              designerFullName: 'Марина Соколова',
              confluenceUrl: 'https://confluence.example.com/display/APP/Feature+101'
            },
            {
              id: 'f2',
              title: 'Фильтры и сортировка',
              completedSteps: ['analytics', 'design', 'discussion', 'handoff'],
              jiraIssueKey: 'APP-102',
              jiraUrl: 'https://jira.example.com/browse/APP-102',
              designerFullName: 'Алексей Карпов',
              confluenceUrl: 'https://confluence.example.com/display/APP/Feature+102'
            },
            {
              id: 'f3',
              title: 'Пагинация / бесконечная прокрутка',
              completedSteps: [],
              jiraIssueKey: 'APP-103',
              jiraUrl: 'https://jira.example.com/browse/APP-103',
              designerFullName: 'Марина Соколова',
              confluenceUrl: 'https://confluence.example.com/display/APP/Feature+103'
            }
          ]
        },
        {
          id: 's2',
          title: 'Корзина',
          features: [
            {
              id: 'f4',
              title: 'Список товаров',
              completedSteps: ['analytics'],
              jiraIssueKey: 'APP-104',
              jiraUrl: 'https://jira.example.com/browse/APP-104',
              designerFullName: 'Дмитрий Лебедев',
              confluenceUrl: 'https://confluence.example.com/display/APP/Feature+104'
            },
            {
              id: 'f5',
              title: 'Промокод',
              completedSteps: [],
              jiraIssueKey: 'APP-105',
              jiraUrl: 'https://jira.example.com/browse/APP-105',
              designerFullName: 'Дмитрий Лебедев',
              confluenceUrl: 'https://confluence.example.com/display/APP/Feature+105'
            }
          ]
        }
      ]
    },
    {
      id: 'p2',
      title: 'Геном 2.0',
      connectedLibraryIds: ['lib-core'],
      screens: [
        {
          id: 's3',
          title: 'Отчёт о прошивках',
          features: [
            {
              id: 'f6',
              title: 'Отчёт о прошивках',
              completedSteps: [],
              jiraIssueKey: 'GEN-201',
              jiraUrl: 'https://jira.example.com/browse/GEN-201',
              designerFullName: 'Екатерина Миронова',
              confluenceUrl: 'https://confluence.example.com/display/GEN/Firmware+Report+Screen'
            },
            {
              id: 'f7',
              title: 'Ролевая модель и токены доступа',
              completedSteps: [],
              jiraIssueKey: 'GEN-202',
              jiraUrl: 'https://jira.example.com/browse/GEN-202',
              designerFullName: 'Екатерина Миронова',
              confluenceUrl: 'https://confluence.example.com/display/GEN/Access+Control'
            }
          ]
        }
      ]
    }
  ]
}

const products = ref<Product[]>(loadProducts())
const context = ref<ProjectContext | null>(loadContext())

// Persist to localStorage
watch(products, (val) => localStorage.setItem(LS_PRODUCTS, JSON.stringify(val)), { deep: true })
watch(context, (val) => localStorage.setItem(LS_CONTEXT, JSON.stringify(val)))

// ── Disk sync (Tauri only) ────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleDiskSave() {
  if (!workspacePath.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const root = workspacePath.value
    if (!root) return
    void writeNorkaJson(root, products.value).then(() =>
      ensureWorkspaceStructure(root, products.value)
    )
  }, 800)
}

watch(products, scheduleDiskSave, { deep: true })

/** Load products from disk into the store (call after setting workspacePath) */
async function loadFromDisk(rootPath: string): Promise<boolean> {
  const loaded = await readNorkaJson(rootPath)
  if (!loaded) return false
  products.value = loaded
  return true
}

/** Open a workspace folder (sets workspacePath and loads data) */

// ── Composable ────────────────────────────────────────────────────────────────

export function useProjects() {
  // ── Lookup helpers ──────────────────────────────────────────────────────────

  function findProduct(id: string) {
    return products.value.find((p) => p.id === id) ?? null
  }
  function findScreen(productId: string, screenId: string) {
    return findProduct(productId)?.screens.find((s) => s.id === screenId) ?? null
  }
  function findFeature(productId: string, screenId: string, featureId: string) {
    return findScreen(productId, screenId)?.features.find((f) => f.id === featureId) ?? null
  }

  // ── Current context ─────────────────────────────────────────────────────────

  const currentProduct = computed(() =>
    context.value ? findProduct(context.value.productId) : null
  )
  const currentScreen = computed(() =>
    context.value ? findScreen(context.value.productId, context.value.screenId) : null
  )
  const currentFeature = computed(() =>
    context.value
      ? findFeature(context.value.productId, context.value.screenId, context.value.featureId)
      : null
  )

  function setContext(productId: string, screenId: string, featureId: string) {
    context.value = { productId, screenId, featureId }
  }

  function clearContext() {
    context.value = null
  }

  // ── Step helpers ────────────────────────────────────────────────────────────

  function stepIndex(step: PipelineStep): number {
    return PIPELINE_STEPS.find((s) => s.key === step)?.index ?? -1
  }

  function lastCompletedStep(feature: Feature): PipelineStep | null {
    if (feature.completedSteps.length === 0) return null
    return feature.completedSteps.reduce((a, b) => (stepIndex(a) > stepIndex(b) ? a : b))
  }

  function stepProgress(feature: Feature): number {
    const last = lastCompletedStep(feature)
    if (!last) return 0
    return (stepIndex(last) + 1) / PIPELINE_STEPS.length
  }

  function isStepCompleted(feature: Feature, step: PipelineStep): boolean {
    return feature.completedSteps.includes(step)
  }

  /** Mark a step as visited/completed (only advances, never removes) */
  function markStepVisited(
    productId: string,
    screenId: string,
    featureId: string,
    step: PipelineStep
  ) {
    const feature = findFeature(productId, screenId, featureId)
    if (!feature) return
    if (!feature.completedSteps.includes(step)) {
      feature.completedSteps.push(step)
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  function addProduct(title: string): Product {
    const product: Product = { id: `p-${Date.now()}`, title, screens: [], connectedLibraryIds: [] }
    products.value.push(product)
    return product
  }

  function connectLibrary(productId: string, libraryId: string) {
    const product = findProduct(productId)
    if (!product) return
    if (!product.connectedLibraryIds.includes(libraryId)) {
      product.connectedLibraryIds.push(libraryId)
    }
  }

  function disconnectLibrary(productId: string, libraryId: string) {
    const product = findProduct(productId)
    if (!product) return
    const i = product.connectedLibraryIds.indexOf(libraryId)
    if (i !== -1) product.connectedLibraryIds.splice(i, 1)
  }

  function addScreen(productId: string, title: string): Screen | null {
    const product = findProduct(productId)
    if (!product) return null
    const screen: Screen = { id: `s-${Date.now()}`, title, features: [] }
    product.screens.push(screen)
    return screen
  }

  interface FeatureMetaInput {
    jiraIssueKey?: string
    jiraUrl?: string
    designerFullName?: string
    confluenceUrl?: string
  }

  function addFeature(
    productId: string,
    screenId: string,
    title: string,
    meta?: FeatureMetaInput
  ): Feature | null {
    const screen = findScreen(productId, screenId)
    if (!screen) return null
    const feature: Feature = {
      id: `f-${Date.now()}`,
      title,
      completedSteps: [],
      jiraIssueKey: meta?.jiraIssueKey ?? '',
      jiraUrl: meta?.jiraUrl ?? '',
      designerFullName: meta?.designerFullName ?? '',
      confluenceUrl: meta?.confluenceUrl ?? ''
    }
    screen.features.push(feature)
    return feature
  }

  function updateFeatureMeta(
    productId: string,
    screenId: string,
    featureId: string,
    meta: FeatureMetaInput
  ) {
    const feature = findFeature(productId, screenId, featureId)
    if (!feature) return
    feature.jiraIssueKey = meta.jiraIssueKey ?? feature.jiraIssueKey
    feature.jiraUrl = meta.jiraUrl ?? feature.jiraUrl
    feature.designerFullName = meta.designerFullName ?? feature.designerFullName
    feature.confluenceUrl = meta.confluenceUrl ?? feature.confluenceUrl
  }

  function deleteProduct(productId: string) {
    const i = products.value.findIndex((p) => p.id === productId)
    if (i !== -1) products.value.splice(i, 1)
    if (context.value?.productId === productId) context.value = null
  }

  function deleteScreen(productId: string, screenId: string) {
    const product = findProduct(productId)
    if (!product) return
    const i = product.screens.findIndex((s) => s.id === screenId)
    if (i !== -1) product.screens.splice(i, 1)
    if (context.value?.productId === productId && context.value.screenId === screenId) {
      context.value = null
    }
  }

  function deleteFeature(productId: string, screenId: string, featureId: string) {
    const screen = findScreen(productId, screenId)
    if (!screen) return
    const i = screen.features.findIndex((f) => f.id === featureId)
    if (i !== -1) screen.features.splice(i, 1)
    if (context.value?.featureId === featureId) context.value = null
  }

  return {
    products,
    context,
    workspacePath,
    currentProduct,
    currentScreen,
    currentFeature,
    setContext,
    clearContext,
    findProduct,
    findScreen,
    findFeature,
    lastCompletedStep,
    stepProgress,
    isStepCompleted,
    markStepVisited,
    addProduct,
    addScreen,
    addFeature,
    updateFeatureMeta,
    deleteProduct,
    deleteScreen,
    deleteFeature,
    connectLibrary,
    disconnectLibrary,
    loadFromDisk,
    PIPELINE_STEPS
  }
}
