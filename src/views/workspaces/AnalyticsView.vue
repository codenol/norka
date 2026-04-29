<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import { computed, markRaw, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
  SplitterGroup,
  SplitterPanel,
  SplitterResizeHandle
} from 'reka-ui'

import ChatPanel from '@/components/ChatPanel.vue'
import Tip from '@/components/ui/Tip.vue'
import { createModel, useAIChat } from '@/composables/use-chat'
import { useSettingsDialog } from '@/composables/use-settings-dialog'
import { useProjects } from '@/composables/use-projects'
import { workspacePath, writeFeatureFile, readFeatureFile } from '@/composables/use-workspace-fs'
import {
  GENOM_GOLDEN_REFERENCE,
  validateAnalyticsDesignSources
} from '@/composables/use-analytics-design'
import {
  buildAssemblyPlanFromEnterprisePlan,
  buildRenderTree,
  buildEnterpriseScreenPlan,
  enterprisePlanToScreenPlan,
  evaluateQualityGate,
  normalizeRenderPlan,
  RENDER_CONTRACT_VERSION
} from '@/ai/screen-pipeline'
import {
  IS_TAURI,
  buildAnalyticsFeatureAnalysisPrompt
} from '@/constants'
import { toast } from '@/utils/toast'
import { parseStructuredAnalyticsPayload } from '@/utils/analytics-chat'
import { buildWorkspacePath } from '@/utils/workspace-route'

import type { UIMessage } from 'ai'
import type { StructuredAnalyticsPayload, StructuredSection } from '@/utils/analytics-chat'

const BRIEF_SECTIONS = [
  { id: 'task', title: 'Задача' },
  { id: 'users', title: 'Пользователь' },
  { id: 'scenarios', title: 'Сценарии' },
  { id: 'states', title: 'Состояния' },
  { id: 'constraints', title: 'Ограничения' },
  { id: 'metrics', title: 'Метрики' },
  { id: 'questions', title: 'Открытые вопросы' }
] as const
const PENDING_ANALYTICS_PROMPT_KEY = 'norka:pending-analytics-prompt'
const PENDING_ANALYTICS_PROMPT_EVENT = 'norka:pending-analytics-prompt:updated'
const PREVIEW_LAYOUT_UPDATED_EVENT = 'norka:preview-layout:updated'
type BriefSectionId = (typeof BRIEF_SECTIONS)[number]['id']

const briefContent = ref<Record<BriefSectionId, string>>({
  task: '',
  users: '',
  scenarios: '',
  states: '',
  constraints: '',
  metrics: '',
  questions: ''
})
const analyticsSource = ref('')
const isHydratingAnalyticsFiles = ref(false)

function resetBriefContent() {
  for (const section of BRIEF_SECTIONS) {
    briefContent.value[section.id] = ''
  }
}

function parseBriefMd(md: string) {
  resetBriefContent()
  for (const section of BRIEF_SECTIONS) {
    const regex = new RegExp(`## ${section.title}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
    const match = md.match(regex)
    if (match) briefContent.value[section.id] = match[1].trim()
  }
}

function briefToMd(): string {
  const lines = ['# Аналитика\n']
  for (const s of BRIEF_SECTIONS) lines.push(`## ${s.title}\n\n${briefContent.value[s.id]}\n`)
  return lines.join('\n')
}

const router = useRouter()
const { isConfigured, providerID, ensureChat, chatSessions } = useAIChat()
const settings = useSettingsDialog()
const { context: projectContext, currentProduct, currentScreen, currentFeature } = useProjects()
const chatInst = ref<Chat<UIMessage> | null>(null)
const chatMessages = computed(() => chatInst.value?.messages ?? [])
const chatStatus = computed(() => chatInst.value?.status ?? 'ready')
const isChatBusy = computed(
  () => chatStatus.value === 'streaming' || chatStatus.value === 'submitted'
)
const importedStructuredMessageIds = ref<Set<string>>(new Set())
const selectedSceneLabel = ref<string | null>(null)
const missingComponentCount = ref<number | null>(null)
const pipelineStatus = ref<string>('План экрана уточняется')

function getFeatureStorageRoot(): string | null {
  if (workspacePath.value) return workspacePath.value
  return IS_TAURI ? null : 'browser'
}

function resetImportedStructuredMessages() {
  importedStructuredMessageIds.value = new Set()
}

async function ensureAnalyticsChat() {
  if (!isConfigured.value) return
  const chat = await ensureChat('analytics')
  chatInst.value = chat ? markRaw(chat) : null
}

async function loadAnalyticsFilesForCurrentContext() {
  isHydratingAnalyticsFiles.value = true
  try {
    resetBriefContent()
    analyticsSource.value = ''
    if (!projectContext.value) return
    const root = getFeatureStorageRoot()
    if (!root) return
    const { productId, screenId, featureId } = projectContext.value
    const [md, sourceMd] = await Promise.all([
      readFeatureFile(root, productId, screenId, featureId, 'analytics.md'),
      readFeatureFile(root, productId, screenId, featureId, 'analytics-source.md')
    ])
    if (md) parseBriefMd(md)
    analyticsSource.value = sourceMd
  } finally {
    isHydratingAnalyticsFiles.value = false
  }
}

async function loadPreviewLayoutStatus() {
  selectedSceneLabel.value = null
  missingComponentCount.value = null
  pipelineStatus.value = 'План экрана уточняется'
  if (!projectContext.value) return
  const root = getFeatureStorageRoot()
  if (!root) return
  const { productId, screenId, featureId } = projectContext.value
  const raw = await readFeatureFile(root, productId, screenId, featureId, 'preview-layout.json')
  if (!raw.trim()) return
  try {
    const parsed = JSON.parse(raw) as {
      screenPlan?: { selectedScene?: string; sceneId?: string }
      componentMapping?: { missingComponents?: Array<unknown> }
      flow?: { status?: string }
      qualityGate?: { passed?: boolean; failReasons?: string[] }
    }
    selectedSceneLabel.value = parsed.screenPlan?.selectedScene ?? parsed.screenPlan?.sceneId ?? null
    const missing = parsed.componentMapping?.missingComponents
    if (Array.isArray(missing)) missingComponentCount.value = missing.length
    if (parsed.qualityGate?.passed === false) {
      pipelineStatus.value = 'Черновик неполный'
    } else {
      pipelineStatus.value = parsed.flow?.status ?? 'Сборка'
    }
  } catch {
    selectedSceneLabel.value = null
    missingComponentCount.value = null
    pipelineStatus.value = 'План экрана уточняется'
  }
}

function queueAnalyticsPrompt(text: string) {
  localStorage.setItem(
    PENDING_ANALYTICS_PROMPT_KEY,
    JSON.stringify({ text, target: 'analytics', createdAt: Date.now() })
  )
  window.dispatchEvent(new CustomEvent(PENDING_ANALYTICS_PROMPT_EVENT))
}

async function startDiscussion() {
  if (!isConfigured.value) {
    settings.show()
    toast.warning('Сначала настройте AI-провайдер')
    return
  }

  const ctx = projectContext.value
  const scopeKey = ctx
    ? `analytics:${ctx.productId}:${ctx.screenId}:${ctx.featureId}`
    : 'analytics:global'
  const hasMessages = chatSessions.getMessages(scopeKey).length > 0
  if (
    hasMessages &&
    !window.confirm('Точно хотите начать заново? Это обнулит весь диалог')
  ) {
    return
  }

  await ensureAnalyticsChat()
  if (isChatBusy.value) {
    chatInst.value?.stop()
  }

  if (hasMessages) {
    chatSessions.saveMessages(scopeKey, [])
  }
  resetImportedStructuredMessages()

  const productMeta = currentProduct.value as unknown as Record<string, unknown> | null
  const screenMeta = currentScreen.value as unknown as Record<string, unknown> | null
  queueAnalyticsPrompt(
    buildAnalyticsFeatureAnalysisPrompt({
      projectTitle: currentProduct.value?.title,
      screenTitle: currentScreen.value?.title,
      featureTitle: currentFeature.value?.title?.trim() || 'Без названия',
      projectDescription:
        typeof productMeta?.description === 'string' ? productMeta.description : undefined,
      screenDescription:
        typeof screenMeta?.description === 'string' ? screenMeta.description : undefined
    })
  )
}

onMounted(async () => {
  await loadAnalyticsFilesForCurrentContext()
  await loadPreviewLayoutStatus()
  if (isConfigured.value) await ensureAnalyticsChat()
  window.addEventListener(PREVIEW_LAYOUT_UPDATED_EVENT, loadPreviewLayoutStatus)
})

onUnmounted(() => {
  window.removeEventListener(PREVIEW_LAYOUT_UPDATED_EVENT, loadPreviewLayoutStatus)
})

watch(
  [workspacePath, projectContext],
  () => {
    void loadAnalyticsFilesForCurrentContext()
    void loadPreviewLayoutStatus()
  },
  { immediate: true }
)

watch(isConfigured, (configured) => {
  if (configured) void ensureAnalyticsChat()
  else chatInst.value = null
})

const savingBrief = ref(false)
const briefDirty = ref(false)
const lastSaved = ref(false)
const savingSource = ref(false)
const sourceDirty = ref(false)
let sourceSaveTimer: ReturnType<typeof setTimeout> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

async function saveBrief() {
  if (!projectContext.value) return
  const root = getFeatureStorageRoot()
  if (!root) return
  savingBrief.value = true
  try {
    const { productId, screenId, featureId } = projectContext.value
    await writeFeatureFile(
      root,
      productId,
      screenId,
      featureId,
      'analytics.md',
      briefToMd()
    )
    lastSaved.value = true
    briefDirty.value = false
  } finally {
    savingBrief.value = false
  }
}

async function saveAnalyticsSource() {
  if (!projectContext.value) return
  const root = getFeatureStorageRoot()
  if (!root) return
  savingSource.value = true
  try {
    const { productId, screenId, featureId } = projectContext.value
    await writeFeatureFile(
      root,
      productId,
      screenId,
      featureId,
      'analytics-source.md',
      analyticsSource.value
    )
    sourceDirty.value = false
  } finally {
    savingSource.value = false
  }
}

watch(analyticsSource, () => {
  if (isHydratingAnalyticsFiles.value) return
  if (!projectContext.value || !getFeatureStorageRoot()) return
  sourceDirty.value = true
  if (sourceSaveTimer) clearTimeout(sourceSaveTimer)
  sourceSaveTimer = setTimeout(() => void saveAnalyticsSource(), 1200)
})

watch(
  briefContent,
  () => {
    if (isHydratingAnalyticsFiles.value) return
    if (!projectContext.value || !getFeatureStorageRoot()) return
    briefDirty.value = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void saveBrief(), 1500)
  },
  { deep: true }
)

const saveStatusLabel = computed(() => {
  if (savingBrief.value) return 'Сохраняю…'
  if (briefDirty.value) return 'Не сохранено'
  if (lastSaved.value) return 'Сохранено'
  return null
})

const isUpdatingBrief = ref(false)
const updateBriefProgress = ref(0)
let updateBriefProgressTimer: ReturnType<typeof setTimeout> | null = null

function clearUpdateBriefProgressTimer() {
  if (!updateBriefProgressTimer) return
  clearTimeout(updateBriefProgressTimer)
  updateBriefProgressTimer = null
}

function startUpdateBriefProgress() {
  clearUpdateBriefProgressTimer()
  updateBriefProgress.value = 0
  const tick = () => {
    if (!isUpdatingBrief.value) return
    updateBriefProgress.value = Math.min(87, updateBriefProgress.value + 2)
    updateBriefProgressTimer = setTimeout(tick, 220)
  }
  updateBriefProgressTimer = setTimeout(tick, 120)
}

function finishUpdateBriefProgress(): Promise<void> {
  clearUpdateBriefProgressTimer()
  return new Promise((resolve) => {
    const rush = () => {
      if (updateBriefProgress.value >= 100) return resolve()
      updateBriefProgress.value = Math.min(100, updateBriefProgress.value + 6)
      updateBriefProgressTimer = setTimeout(rush, 24)
    }
    updateBriefProgressTimer = setTimeout(rush, 10)
  })
}

function getText(msg: UIMessage): string {
  for (const part of msg.parts ?? []) {
    if ((part as Record<string, unknown>).type === 'text')
      return (part as { type: string; text: string }).text
  }
  return (msg as unknown as { content?: string }).content ?? ''
}

function waitForReady(inst: Chat<UIMessage>, timeout = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (inst.status === 'ready' || inst.status === 'error') return resolve()
      if (Date.now() - start > timeout) return reject(new Error('Timeout'))
      setTimeout(check, 200)
    }
    check()
  })
}

function extractBriefJson(raw: string): Record<string, string> | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as Record<string, string>
  } catch {
    return null
  }
}

function appendBriefSection(section: StructuredSection, answer: string): boolean {
  const normalized = answer.trim()
  if (!normalized) return false
  const current = briefContent.value[section].trim()
  const blocks = current
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  if (blocks.includes(normalized)) return false
  briefContent.value[section] = current ? `${current}\n\n${normalized}` : normalized
  return true
}

function getStructuredAnalyticsPayload(message: UIMessage): StructuredAnalyticsPayload | null {
  if (message.role !== 'assistant') return null
  return parseStructuredAnalyticsPayload(getText(message))
}

function isStructuredAssistantMessageImported(messageId: string): boolean {
  return importedStructuredMessageIds.value.has(messageId)
}

function importStructuredAssistantMessage(message: UIMessage) {
  if (message.role !== 'assistant') return
  if (isStructuredAssistantMessageImported(message.id)) return
  const payload = getStructuredAnalyticsPayload(message)
  if (!payload) {
    toast.warning(
      'Ответ аналитики не распознан. Ожидается JSON: section, answer, nextQuestion, readyToSave.'
    )
    return
  }
  if (!payload.readyToSave || !payload.answer) return
  const didAppend = appendBriefSection(payload.section, payload.answer)
  importedStructuredMessageIds.value = new Set(importedStructuredMessageIds.value).add(message.id)
  if (!didAppend) {
    toast.warning('Этот ответ уже есть в analytics.md')
  }
}

async function updateBriefFromChat() {
  if (!isConfigured.value || chatMessages.value.length < 2) return
  isUpdatingBrief.value = true
  startUpdateBriefProgress()
  try {
    const isLMStudio = providerID.value === 'lm-studio'
    const context = chatMessages.value
      .map((m) => `${m.role === 'user' ? 'Пользователь' : 'AI'}: ${getText(m)}`)
      .join('\n')
    const currentBrief = BRIEF_SECTIONS.map(
      (s) => `## ${s.title}\n${briefContent.value[s.id] || '(пусто)'}`
    ).join('\n\n')
    const prompt = `Диалог:\n${context}\n\nТекущий бриф:\n${currentBrief}\n\nВерни только JSON:\n{"task":"...","users":"...","scenarios":"...","states":"...","constraints":"...","metrics":"...","questions":"..."}`
    const agent = new ToolLoopAgent({
      model: createModel(),
      instructions: 'Возвращай только валидный JSON без markdown.',
      stopWhen: stepCountIs(1),
      maxOutputTokens: isLMStudio ? undefined : 2048
    })
    const docChat = new Chat<UIMessage>({
      transport: new DirectChatTransport({ agent }) as unknown as Chat<UIMessage>['transport'],
      messages: []
    })
    await docChat.sendMessage({ text: prompt })
    await waitForReady(docChat)
    const last = docChat.messages.at(-1)
    const parsed = last ? extractBriefJson(getText(last)) : null
    if (!parsed) return
    for (const s of BRIEF_SECTIONS) {
      if (parsed[s.id]?.trim()) briefContent.value[s.id] = parsed[s.id]
    }
  } finally {
    await finishUpdateBriefProgress()
    clearUpdateBriefProgressTimer()
    isUpdatingBrief.value = false
  }
}

const isGeneratingDesign = ref(false)
const isGeneratingJsonScreen = ref(false)
const DEFAULT_SCENE_ID = 'overview-dashboard'
const analyticsPlanBlocks = computed(() => {
  const rows: Array<{ title: string; description: string }> = []
  if (briefContent.value.task.trim()) {
    rows.push({ title: 'Цель экрана', description: briefContent.value.task.trim() })
  }
  if (briefContent.value.users.trim()) {
    rows.push({ title: 'Пользователь', description: briefContent.value.users.trim() })
  }
  if (briefContent.value.scenarios.trim()) {
    rows.push({ title: 'Основные сценарии', description: briefContent.value.scenarios.trim() })
  }
  if (briefContent.value.states.trim()) {
    rows.push({ title: 'Состояния', description: briefContent.value.states.trim() })
  }
  if (briefContent.value.metrics.trim()) {
    rows.push({ title: 'Метрики', description: briefContent.value.metrics.trim() })
  }
  if (briefContent.value.constraints.trim()) {
    rows.push({ title: 'Ограничения', description: briefContent.value.constraints.trim() })
  }
  return rows.slice(0, 8)
})
const screenPlanReady = computed(() => analyticsPlanBlocks.value.length >= 4)

async function generateDesignFromAnalytics() {
  if (isGeneratingDesign.value) return
  if (!isConfigured.value) {
    settings.show()
    toast.warning('Сначала настройте AI-провайдер')
    return
  }
  isGeneratingDesign.value = true
  try {
    if (workspacePath.value && projectContext.value) {
      await Promise.all([saveBrief(), saveAnalyticsSource()])
    }
    const validation = validateAnalyticsDesignSources({
      analyticsMd: briefToMd(),
      analyticsSourceMd: analyticsSource.value
    })
    if (!validation.ok) {
      toast.error(validation.message)
      return
    }
    let enterprisePlanPayload: ReturnType<typeof buildEnterpriseScreenPlan> | null = null
    let screenPlanPayload: ReturnType<typeof enterprisePlanToScreenPlan> | null = null
    let assemblyPlanPayload: ReturnType<typeof buildAssemblyPlanFromEnterprisePlan> | null = null
    if (projectContext.value) {
      const root = getFeatureStorageRoot()
      if (root) {
        const { productId, screenId, featureId } = projectContext.value
        const enterpriseScreenPlan = buildEnterpriseScreenPlan(briefToMd(), analyticsSource.value)
        const screenPlan = enterprisePlanToScreenPlan(enterpriseScreenPlan)
        const assemblyPlan = buildAssemblyPlanFromEnterprisePlan(enterpriseScreenPlan)
        const normalizedAssemblyPlan =
          Array.isArray(assemblyPlan.steps) && assemblyPlan.steps.length > 0
            ? assemblyPlan
            : buildAssemblyPlanFromEnterprisePlan(enterpriseScreenPlan)
        enterprisePlanPayload = enterpriseScreenPlan
        screenPlanPayload = screenPlan
        assemblyPlanPayload = assemblyPlan
        const qualityGate = evaluateQualityGate({
          nodeCount: 0,
          requiredSections: screenPlan.requiredSections.map((section) => section.id),
          presentSections: [],
          missingComponents: [],
          repairAttempts: 0
        })
        await writeFeatureFile(
          root,
          productId,
          screenId,
          featureId,
          'preview-layout.json',
          JSON.stringify(
            (() => {
              const payload = {
                mode: 'auto-scene',
                contractVersion: RENDER_CONTRACT_VERSION,
                enterpriseScreenPlan,
                planVersions: [
                  {
                    version: 1,
                    createdAt: Date.now(),
                    stage: 'planning',
                    plan: enterpriseScreenPlan
                  }
                ],
                screenPlan,
                assemblyPlan: normalizedAssemblyPlan,
                componentMapping: {
                  blocks: [],
                  availableComponents: [],
                  missingComponents: [],
                  fallbackPlan: []
                },
                flow: {
                  planGenerated: true,
                  assembled: false,
                  stage: 'planning',
                  status:
                    normalizedAssemblyPlan.steps.length === assemblyPlan.steps.length
                      ? 'ready'
                      : 'partial'
                },
                qualityGate,
                goldenReference:
                  /геном|прошив/i.test(`${briefToMd()}\n${analyticsSource.value}`)
                    ? GENOM_GOLDEN_REFERENCE
                    : null
              }
              const contractCheck = normalizeRenderPlan(payload)
              if (!contractCheck.ok) {
                return {
                  ...payload,
                  flow: {
                    ...payload.flow,
                    status: 'invalid-contract',
                    diagnostics: contractCheck.diagnostics
                  }
                }
              }
              return payload
            })(),
            null,
            2
          )
        )
        window.dispatchEvent(new CustomEvent(PREVIEW_LAYOUT_UPDATED_EVENT))
      }
    }
    if (!projectContext.value) {
      toast.error('Контекст фичи не выбран')
      return
    }
    await router.push(buildWorkspacePath('design', projectContext.value))
  } finally {
    isGeneratingDesign.value = false
  }
}

async function generateJsonScreenFromAnalytics() {
  if (isGeneratingJsonScreen.value) return
  if (!projectContext.value) {
    toast.error('Контекст фичи не выбран')
    return
  }
  isGeneratingJsonScreen.value = true
  try {
    const enterpriseScreenPlan = buildEnterpriseScreenPlan(briefToMd(), analyticsSource.value)
    const assemblyPlan = buildAssemblyPlanFromEnterprisePlan(enterpriseScreenPlan)
    const renderTree = buildRenderTree(enterpriseScreenPlan, assemblyPlan)
    const payload = {
      meta: {
        miniBar: [
          { icon: 'layout-grid', active: false },
          { icon: 'blocks', active: false },
          { icon: 'network', active: false },
          { icon: 'settings-2', active: true }
        ]
      },
      sidebar: renderTree.sidebar,
      breadcrumbs: renderTree.breadcrumbs,
      main: renderTree.main,
      actions: renderTree.actions
    }
    await writeToClipboard(JSON.stringify(payload, null, 2))
    toast.info('JSON создан и скопирован')
  } catch {
    toast.error('Не удалось создать JSON')
  } finally {
    isGeneratingJsonScreen.value = false
  }
}

const canSaveBrief = computed(
  () => Boolean(projectContext.value && getFeatureStorageRoot()) && !savingBrief.value
)

const isApplyingDemo = ref(false)

function buildDemoBrief(): Record<BriefSectionId, string> {
  const screenTitle = currentScreen.value?.title?.trim() || 'Экран'
  const featureTitle = currentFeature.value?.title?.trim() || 'Фича'
  const productTitle = currentProduct.value?.title?.trim() || 'Проект'
  const isGenomFirmwareReport =
    productTitle.toLowerCase().includes('геном') &&
    (screenTitle.toLowerCase().includes('прошив') || featureTitle.toLowerCase().includes('прошив'))
  if (isGenomFirmwareReport) {
    return {
      task: 'Собрать enterprise-экран «Отчёт о прошивках» для Геном 2.0: быстрый контроль соответствия прошивок по узлам и модулям, массовая диагностика отклонений и подготовка выгрузки.',
      users:
        'Основные пользователи: инженер эксплуатации, инженер платформы и администратор безопасности. Они открывают экран ежедневно для проверки статусов прошивок, поиска критичных расхождений и фиксации действий.',
      scenarios:
        '1) Открыть отчёт и быстро увидеть проблемные узлы по статусам. 2) Отфильтровать по типу/модели/узлу и найти точечные расхождения. 3) Выделить несколько строк и выполнить массовое действие (экспорт/диагностика). 4) Перейти к деталям узла из таблицы.',
      states:
        'Healthy: прошивка соответствует эталону. Warning: есть несовпадения, требуется проверка. Critical: критическое отклонение, нужно срочное действие. Disabled: данные по узлу временно недоступны.',
      constraints:
        'Интерфейс в стиле enterprise SaaS: минибар + сайдбар + breadcrumbs + фильтры + большая таблица. Первая полезная отрисовка до 2 секунд. Не менее 10 строк в таблице. Поддержка массовых операций и плотного табличного режима.',
      metrics:
        'Time-to-detect критичного отклонения, доля узлов в статусе Healthy, среднее время фильтрации до результата, доля сессий с массовыми действиями, точность идентификации проблемного модуля.',
      questions:
        'Нужны ли предустановленные фильтры по окружениям? Какие поля обязательны для экспорта? Должны ли действия в toolbar быть role-based?'
    }
  }
  return {
    task: `Главная задача страницы «${screenTitle}» — дать пользователю быстрый и понятный обзор состояния по фиче «${featureTitle}», чтобы ускорить принятие решений и снизить время на ручную проверку данных.`,
    users:
      'Основной пользователь — администратор/аналитик. Он регулярно открывает страницу в течение дня, чтобы контролировать ключевые метрики и вовремя реагировать на отклонения.',
    scenarios:
      '1) Быстрый утренний просмотр состояния. 2) Проверка причин отклонений после алерта. 3) Сравнение текущих значений с предыдущим периодом перед принятием решения.',
    states:
      'Healthy: все ключевые показатели в пределах нормы. Warning: есть отклонения, нужен дополнительный анализ. Critical: обнаружена критичная проблема, требуется немедленное действие.',
    constraints:
      'Обновление данных не реже 1 раза в минуту. Время первого отображения до 2 секунд. Корректная работа на desktop-экранах от 1280px. Все значения должны иметь единые форматы и подписи.',
    metrics:
      'Время до первого полезного отображения, доля пользователей, нашедших причину инцидента без перехода на другие страницы, время реакции на критичное состояние, точность интерпретации статусов.',
    questions:
      'Нужно ли показывать исторические данные на этой же странице? Какие пороги для Warning/Critical считаются официальными? Какие действия пользователь должен выполнять прямо из этого экрана?'
  }
}

async function applyDemoBrief() {
  if (isApplyingDemo.value) return
  if (!projectContext.value) {
    toast.error('Контекст фичи не выбран')
    return
  }
  isApplyingDemo.value = true
  try {
    const demo = buildDemoBrief()
    briefContent.value = { ...demo }
    analyticsSource.value = [
      `DEMO: ${new Date().toISOString()}`,
      `Проект: ${currentProduct.value?.title ?? 'Без названия'}`,
      `Экран: ${currentScreen.value?.title ?? 'Без названия'}`,
      `Фича: ${currentFeature.value?.title ?? 'Без названия'}`,
      'Источник создан автоматически для демонстрации полного заполнения analytics.md.',
      'Golden reference: side mini-bar + navigation sidebar + breadcrumbs + firmware report table.'
    ].join('\n')
    await Promise.all([saveBrief(), saveAnalyticsSource()])
    toast.info('Демо-данные analytics.md заполнены')
  } finally {
    isApplyingDemo.value = false
  }
}

async function copyBriefMarkdown() {
  await writeToClipboard(briefToMd())
}

async function writeToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('Clipboard write failed')
}
</script>

<template>
  <div class="flex h-full w-full select-text flex-col overflow-hidden">
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <icon-lucide-brain-circuit class="size-3.5 text-accent" />
      <span class="text-xs font-medium text-surface">Аналитика</span>
      <div class="h-4 w-px bg-border" />
      <button
        :disabled="isChatBusy"
        class="flex items-center gap-1.5 rounded border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/15 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        @click="startDiscussion"
      >
        <icon-lucide-messages-square class="size-3.5" />
        Запустить обсуждение
      </button>
      <button
        :disabled="isApplyingDemo || isChatBusy || !projectContext"
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-40"
        @click="applyDemoBrief"
      >
        <icon-lucide-flask-conical class="size-3.5" />
        {{ isApplyingDemo ? 'Заполняю…' : 'Демо' }}
      </button>
      <button
        :disabled="!isConfigured || chatMessages.length < 2 || isUpdatingBrief"
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-40"
        :class="isUpdatingBrief ? 'text-accent' : 'text-muted'"
        @click="updateBriefFromChat"
      >
        <icon-lucide-loader-circle v-if="isUpdatingBrief" class="size-3.5 animate-spin" />
        <icon-lucide-sparkles v-else class="size-3.5" />
        {{ isUpdatingBrief ? 'Обновляю…' : 'Обновить бриф' }}
      </button>
      <button
        :disabled="!isConfigured || isChatBusy || isGeneratingDesign"
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        :class="isGeneratingDesign ? 'text-accent' : 'text-muted hover:bg-hover hover:text-surface'"
        @click="generateDesignFromAnalytics"
      >
        <icon-lucide-loader-circle v-if="isGeneratingDesign" class="size-3.5 animate-spin" />
        <icon-lucide-wand-sparkles v-else class="size-3.5" />
        {{ isGeneratingDesign ? 'Собираю экран…' : 'Собрать экран' }}
      </button>
      <button
        :disabled="isGeneratingJsonScreen || isGeneratingDesign || !projectContext"
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        :class="isGeneratingJsonScreen ? 'text-accent' : 'text-muted hover:bg-hover hover:text-surface'"
        @click="generateJsonScreenFromAnalytics"
      >
        <icon-lucide-loader-circle v-if="isGeneratingJsonScreen" class="size-3.5 animate-spin" />
        <icon-lucide-file-json v-else class="size-3.5" />
        {{ isGeneratingJsonScreen ? 'Создаю JSON…' : 'Создать JSON-экран' }}
      </button>
      <span class="text-[10px] text-muted">
        {{
          screenPlanReady
            ? `${pipelineStatus}${selectedSceneLabel ? ` · Сцена: ${selectedSceneLabel}` : ''}${missingComponentCount !== null ? ` · Missing: ${missingComponentCount}` : ''}`
            : 'План экрана уточняется'
        }}
      </span>
      <div class="flex-1" />
      <span v-if="saveStatusLabel" class="text-[10px] text-muted">{{ saveStatusLabel }}</span>
    </header>

    <SplitterGroup
      direction="horizontal"
      auto-save-id="analytics-layout"
      class="flex-1 overflow-hidden"
    >
      <SplitterPanel
        :default-size="55"
        :min-size="35"
        class="flex flex-col overflow-hidden bg-canvas"
      >
        <ChatPanel
          canvas-target="analytics"
          class="h-full w-full"
          :on-import-structured-analytics="importStructuredAssistantMessage"
          :is-structured-analytics-message-imported="isStructuredAssistantMessageImported"
        />
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div
          class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
        />
      </SplitterResizeHandle>
      <SplitterPanel
        :default-size="45"
        :min-size="28"
        :max-size="60"
        class="flex flex-col overflow-hidden border-l border-border"
      >
        <div class="flex shrink-0 items-center gap-2 border-b border-border bg-panel px-3 py-2">
          <icon-lucide-file-text class="size-3.5 shrink-0 text-accent" />
          <span class="flex-1 text-xs font-medium text-surface">analytics.md</span>
          <Tip label="Скопировать markdown">
            <button
              class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="copyBriefMarkdown"
            >
              <icon-lucide-copy class="size-3.5" />
            </button>
          </Tip>
          <Tip label="Сохранить на диск">
            <button
              :disabled="!canSaveBrief"
              class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
              @click="saveBrief"
            >
              <icon-lucide-save class="size-3.5" />
            </button>
          </Tip>
        </div>
        <ScrollAreaRoot class="flex-1 min-h-0 bg-canvas">
          <ScrollAreaViewport class="h-full overflow-y-auto">
            <div class="flex flex-col divide-y divide-border/60">
              <div class="flex flex-col">
                <div class="bg-panel/60 px-3 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >Источник аналитики (Confluence)</span
                  >
                  <span class="ml-2 text-[10px] text-muted">{{
                    savingSource ? 'Сохраняю…' : sourceDirty ? 'Не сохранено' : 'Сохранено'
                  }}</span>
                </div>
                <textarea
                  v-model="analyticsSource"
                  class="min-h-[92px] resize-none bg-canvas px-3 py-2.5 text-sm leading-relaxed text-surface outline-none placeholder:text-muted/40 focus:bg-hover/20"
                  style="field-sizing: content"
                />
              </div>
              <div v-for="section in BRIEF_SECTIONS" :key="section.id" class="flex flex-col">
                <div class="bg-panel/60 px-3 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">{{
                    section.title
                  }}</span>
                </div>
                <textarea
                  v-model="briefContent[section.id]"
                  :placeholder="`${section.title}…`"
                  class="min-h-[72px] resize-none bg-canvas px-3 py-2.5 text-sm leading-relaxed text-surface outline-none placeholder:text-muted/40 focus:bg-hover/20"
                  style="field-sizing: content"
                />
              </div>
              <div class="flex flex-col">
                <div class="bg-panel/60 px-3 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >План экрана</span
                  >
                </div>
                <div class="grid grid-cols-1 gap-2 p-3">
                  <div
                    v-for="(block, index) in analyticsPlanBlocks"
                    :key="`${block.title}-${index}`"
                    class="rounded border border-border/70 bg-panel/40 px-2.5 py-2"
                  >
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {{ block.title }}
                    </p>
                    <p class="mt-1 line-clamp-3 text-xs text-surface">
                      {{ block.description }}
                    </p>
                  </div>
                  <p v-if="analyticsPlanBlocks.length === 0" class="text-xs text-muted">
                    Добавьте данные в бриф или импортируйте ответы из чата, чтобы сформировать план.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5"
            ><ScrollAreaThumb class="rounded-full bg-border"
          /></ScrollAreaScrollbar>
        </ScrollAreaRoot>
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
