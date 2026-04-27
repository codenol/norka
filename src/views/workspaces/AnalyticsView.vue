<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
  SplitterGroup,
  SplitterPanel,
  SplitterResizeHandle,
} from 'reka-ui'

import Tip from '@/components/ui/Tip.vue'
import { createModel, useAIChat } from '@/composables/use-chat'
import { useSettingsDialog } from '@/composables/use-settings-dialog'
import { useProjects } from '@/composables/use-projects'
import {
  workspacePath,
  readProjectMd,
  readScreenMd,
  writeFeatureFile,
  readAllComponentRules,
  readFeatureFile
} from '@/composables/use-workspace-fs'
import {
  ANALYTICS_DESIGN_INSTRUCTIONS,
  useAnalyticsDesign,
  validateAnalyticsDesignSources,
} from '@/composables/use-analytics-design'
import { toast } from '@/utils/toast'

import type { UIMessage } from 'ai'

// ── Brief sections ─────────────────────────────────────────────────────────────

const BRIEF_SECTIONS = [
  { id: 'task',        title: 'Задача' },
  { id: 'users',       title: 'Пользователь' },
  { id: 'scenarios',   title: 'Сценарии' },
  { id: 'states',      title: 'Состояния' },
  { id: 'constraints', title: 'Ограничения' },
  { id: 'metrics',     title: 'Метрики' },
  { id: 'questions',   title: 'Открытые вопросы' },
] as const

type BriefSectionId = (typeof BRIEF_SECTIONS)[number]['id']

const DEMO_SOURCE = `# Confluence: Улучшение онбординга команды продаж

## Контекст
- Продукт: B2B CRM для mid-market клиентов
- Проблема: новый менеджер по продажам долго выходит на первую успешную сделку
- Текущее время до первой ценности: 9.4 дня (медиана)

## Наблюдения
1. 62% пользователей пропускают шаг "Подключить почту"
2. 48% не создают первую воронку в первые 24 часа
3. Только 31% доходят до шага "Пригласить коллег"

## Гипотеза
Если сократить первичный путь до 3 понятных шагов с явной выгодой, то activation rate вырастет минимум на 12%.

## Ограничения
- Релиз в течение 2 спринтов
- Без изменений в backend-API
- Локализация RU/EN обязательна
`

const DEMO_BRIEF: Record<BriefSectionId, string> = {
  task: `Сократить время до первой ценности (TTV) для новых sales-менеджеров.
Сделать стартовый опыт проще: пользователь должен за первые 10 минут пройти базовые шаги и увидеть практическую пользу.`,
  users: `Основной сегмент: менеджер по продажам 24-38 лет в B2B-команде из 5-30 человек.
Контекст: много операционных задач, мало времени на обучение.
Потребность: быстро понять "с чего начать", не читать длинные инструкции.
Боли: непонятный порядок шагов, страх "сломать что-то", ощущение перегруженного интерфейса.`,
  scenarios: `1. Новый пользователь регистрируется и попадает в онбординг.
2. Подключает почту и импортирует первые контакты.
3. Создаёт первую воронку из готового шаблона.
4. Добавляет одну сделку и получает подсказку по следующему шагу.
5. Приглашает коллегу для совместной работы.
6. Прерывает онбординг и возвращается позже, продолжая с того же шага.`,
  states: `- Пустое состояние: до старта онбординга.
- Загрузка: импорт контактов, проверка интеграций.
- Успех: шаг завершён, отображается прогресс и следующий CTA.
- Ошибка: подключение почты не удалось / импорт прерван / нет прав.
- Пограничные случаи: пользователь пропустил шаг, нет данных для воронки, отключён JS, мобильный экран.`,
  constraints: `- Дедлайн: 2 спринта.
- Без новых серверных эндпоинтов.
- Совместимость с текущей дизайн-системой.
- Доступность: клавиатурная навигация и контраст WCAG AA.
- Локализация: русский и английский.`,
  metrics: `- Activation rate (завершили 3 ключевых шага) >= 45% (+12 п.п.).
- Время до первой созданной сделки <= 20 минут.
- Completion rate онбординга >= 55%.
- Доля пользователей, вернувшихся на следующий день (D1 retention) +8%.
- Снижение обращений в поддержку по теме старта на 20%.`,
  questions: `- Нужно ли разрешать пропуск "Подключить почту" без штрафа в прогрессе?
- Какие шаблоны воронок приоритетны для MVP?
- Как корректно объяснить выгоду приглашения коллеги на шаге 3?
- Какой fallback для пользователей без корпоративной почты?
- Нужна ли отдельная версия онбординга для администраторов?`,
}

const briefContent = ref<Record<BriefSectionId, string>>({
  task:        '',
  users:       '',
  scenarios:   '',
  states:      '',
  constraints: '',
  metrics:     '',
  questions:   '',
})
const analyticsSource = ref('')
const implementationReady = ref('')

function fillDemoData() {
  analyticsSource.value = DEMO_SOURCE
  briefContent.value = structuredClone(DEMO_BRIEF)
  void generateImplementationReadyDoc()
  toast.info('Демо-данные заполнены')
}

function parseBriefMd(md: string) {
  for (const section of BRIEF_SECTIONS) {
    const regex = new RegExp(`## ${section.title}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
    const match = md.match(regex)
    if (match) briefContent.value[section.id] = match[1].trim()
  }
}

function briefToMd(): string {
  const lines = ['# Аналитика\n']
  for (const s of BRIEF_SECTIONS) {
    lines.push(`## ${s.title}\n\n${briefContent.value[s.id]}\n`)
  }
  return lines.join('\n')
}

// ── Workspace & context ───────────────────────────────────────────────────────

const router = useRouter()
const { isConfigured, providerID, maxOutputTokens, ensureChat } = useAIChat()
const settings = useSettingsDialog()
const { context: projectContext } = useProjects()
const { createAnalyticsTools } = useAnalyticsDesign()

async function buildSystemPrompt(): Promise<string> {
  const base = `Ты — продуктовый аналитик и UX-исследователь. Помоги дизайнеру собрать аналитический бриф для фичи.

Бриф состоит из 7 разделов:
- Задача: что нужно решить, зачем это пользователю и бизнесу
- Пользователь: кто использует, его контекст, потребности, боли
- Сценарии: основные пользовательские сценарии (numbered list)
- Состояния: все состояния экрана/фичи — пустое, загрузка, успех, ошибка, крайние случаи
- Ограничения: технические, бизнесовые, временны́е
- Метрики: как измерить успех дизайна/фичи
- Открытые вопросы: что ещё нужно уточнить перед проектированием

Веди диалог: задавай уточняющие вопросы по одному. Будь кратким. Отвечай на русском языке.`

  if (!workspacePath.value || !projectContext.value) return base

  const { productId, screenId } = projectContext.value
  const [projectMd, screenMd] = await Promise.all([
    readProjectMd(workspacePath.value, productId),
    readScreenMd(workspacePath.value, productId, screenId),
  ])

  const rules = await readAllComponentRules(workspacePath.value)

  const parts = [base]
  if (projectMd) parts.push(`\n\n# Контекст продукта\n${projectMd}`)
  if (screenMd)  parts.push(`\n\n# Контекст экрана\n${screenMd}`)
  if (rules)     parts.push(`\n\n# Правила компонентов дизайн-системы\n${rules}`)
  return parts.join('')
}

// ── Load brief on mount ───────────────────────────────────────────────────────

onMounted(async () => {
  if (!workspacePath.value || !projectContext.value) return
  const { productId, screenId, featureId } = projectContext.value
  try {
    const [md, sourceMd, implementationMd] = await Promise.all([
      readFeatureFile(workspacePath.value, productId, screenId, featureId, 'analytics.md'),
      readFeatureFile(workspacePath.value, productId, screenId, featureId, 'analytics-source.md'),
      readFeatureFile(workspacePath.value, productId, screenId, featureId, 'implementation-ready.md'),
    ])
    if (md) parseBriefMd(md)
    analyticsSource.value = sourceMd
    implementationReady.value = implementationMd
  } catch (error) {
    console.warn('Could not load analytics brief from disk:', error)
  }
})

// ── Auto-save brief ───────────────────────────────────────────────────────────

const savingBrief = ref(false)
const briefDirty = ref(false)
const lastSaved = ref(false) // true = ever saved this session

async function saveBrief() {
  if (!workspacePath.value || !projectContext.value) {
    toast.warning('Откройте проект и фичу, чтобы сохранить analytics.md')
    return
  }
  savingBrief.value = true
  try {
    const { productId, screenId, featureId } = projectContext.value
    await writeFeatureFile(
      workspacePath.value, productId, screenId, featureId,
      'analytics.md', briefToMd(),
    )
    lastSaved.value = true
    briefDirty.value = false
  } catch (e) {
    console.error('Save brief error:', e)
  } finally {
    savingBrief.value = false
  }
}

const savingSource = ref(false)
const sourceDirty = ref(false)
let sourceSaveTimer: ReturnType<typeof setTimeout> | null = null

async function saveAnalyticsSource() {
  if (!workspacePath.value || !projectContext.value) return
  savingSource.value = true
  try {
    const { productId, screenId, featureId } = projectContext.value
    await writeFeatureFile(
      workspacePath.value,
      productId,
      screenId,
      featureId,
      'analytics-source.md',
      analyticsSource.value,
    )
    sourceDirty.value = false
  } finally {
    savingSource.value = false
  }
}

watch(analyticsSource, () => {
  if (!workspacePath.value || !projectContext.value) return
  sourceDirty.value = true
  if (sourceSaveTimer) clearTimeout(sourceSaveTimer)
  sourceSaveTimer = setTimeout(() => {
    void saveAnalyticsSource()
  }, 1200)
})

let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(briefContent, () => {
  if (!workspacePath.value || !projectContext.value) return
  briefDirty.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveBrief(), 1500)
}, { deep: true })

const saveStatusLabel = computed(() => {
  if (savingBrief.value) return 'Сохраняю…'
  if (briefDirty.value) return 'Не сохранено'
  if (lastSaved.value) return 'Сохранено'
  return null
})

// ── AI Chat ───────────────────────────────────────────────────────────────────

const GREETING = 'Привет! Я помогу составить аналитический бриф для этой фичи. Расскажите — какую задачу или проблему мы решаем?'

function makeGreeting(): UIMessage {
  return {
    id: 'init-greeting',
    role: 'assistant',
    content: GREETING,
    parts: [{ type: 'text', text: GREETING }],
  } as UIMessage
}

const inputText = ref('')
const messagesEndRef = ref<HTMLDivElement>()
const chatInst = ref<Chat<UIMessage> | null>(null)
const chatMessages = ref<UIMessage[]>([makeGreeting()])
const chatStatus = ref<string>('ready')

async function createChat(): Promise<Chat<UIMessage>> {
  const isLMStudio = providerID.value === 'lm-studio'
  const baseInstructions = await buildSystemPrompt()
  // Append design tool instructions so AI knows it can assemble mockups
  const instructions = `${baseInstructions}\n\n${ANALYTICS_DESIGN_INSTRUCTIONS}`
  const agent = new ToolLoopAgent({
    model: createModel(),
    instructions,
    tools: createAnalyticsTools(),
    stopWhen: stepCountIs(25),  // increased to allow multi-step mockup assembly
    maxOutputTokens: isLMStudio ? undefined : Math.min(maxOutputTokens.value, 4096),
  })
  const transport = new DirectChatTransport({ agent })
  return new Chat<UIMessage>({ transport, messages: [makeGreeting()] })
}

let statusInterval: ReturnType<typeof setInterval> | null = null
let loadingTypeTimer: ReturnType<typeof setTimeout> | null = null

const LOADING_PHRASES = [
  'Складываю буквы в слова…',
  'Собираю мысли в аккуратные абзацы…',
  'Полирую формулировки до блеска…',
  'Подбираю слова, которые звучат умно…',
  'Наливаю смысл по строчкам…',
  'Укрощаю хаос и делаю выводы…',
  'Сортирую идеи по полочкам…',
  'Собираю аргументы в красивый строй…',
  'Проверяю, где тут самое важное…',
  'Накручиваю нейроны на максимум…',
  'Подогреваю гипотезы до рабочей температуры…',
  'Просеиваю шум, оставляю суть…',
  'Готовлю ответ с хрустящей логикой…',
  'Собираю пазл из контекста…',
  'Глажу углы у формулировок…',
  'Добавляю щепотку ясности…',
  'Взвешиваю варианты на смысловых весах…',
  'Пишу, стираю, делаю вид что так и было…',
  'Тестирую каждое слово на внятность…',
  'Разгоняю вдохновение до рабочей скорости…',
  'Ловлю инсайты в чистый блокнот…',
  'Достраиваю фразу до идеальной дуги…',
  'Переупаковываю мысли в понятный формат…',
  'Выравниваю логику по сетке…',
  'Калибрую тон ответа…',
  'Включаю режим «умно и по делу»…',
  'Собираю тезисы в один маршрут…',
  'Обновляю словарь метких формулировок…',
  'Проветриваю предложения от воды…',
  'Проверяю, не потерялся ли смысл по дороге…',
  'Достаю из рукава лучший вариант…',
  'Прогоняю текст через фильтр «понятно?»…',
  'Раскладываю сложное на простые шаги…',
  'Заполняю пробелы между «почему» и «как»…',
  'Собираю ответ без лишнего пафоса…',
  'Чищу формулировки от шероховатостей…',
  'Вяжу идеи в цельный рассказ…',
  'Сгущаю пользу до концентрата…',
  'Выбираю слова точнее лазера…',
  'Прокладываю маршрут от вопроса к ответу…',
  'Рисую мысленный чертеж ответа…',
  'Обрабатываю входящие мысли напильником…',
  'Подтягиваю контекст из дальних полок памяти…',
  'Клею смысл скотчем логики…',
  'Заряжаю фразы энергией пользы…',
  'Сканирую вопрос на скрытые нюансы…',
  'Шлифую структуру до ровного ритма…',
  'Собираю формулировку «чтобы сразу зашло»…',
  'Нахожу короткий путь к сути…',
  'Сверяю ответ с реальностью и здравым смыслом…',
  'Подбираю примеры, чтобы стало очевидно…',
  'Убираю туман из сложных мест…',
  'Прокладываю мостик от идеи к действию…',
  'Генерирую понятность в промышленных масштабах…',
  'Нормализую поток мыслей…',
  'Готовлю фразы, которые не стыдно процитировать…',
  'Подсвечиваю главное, прячу второстепенное…',
  'Отмеряю нужную дозу деталей…',
  'Согласовываю слова с интонацией…',
  'Собираю ответ как швейцарские часы…',
  'Проверяю, не перегнул ли с умничаньем…',
  'Разворачиваю идею на человеческом языке…',
  'Перевожу сложное с диалекта «эксперт»…',
  'Выстраиваю мысли в аккуратную очередь…',
  'Добавляю мягкие переходы между тезисами…',
  'Ищу самое точное «в двух словах»…',
  'Миксую краткость с полезностью…',
  'Оптимизирую ответ под ваше время…',
  'Перепроверяю, чтобы было без воды…',
  'Готовлю мягкую посадку для сложной темы…',
  'Привожу мысли к единому знаменателю…',
  'Собираю контекст из соседних вселенных…',
  'Проверяю логику на прочность…',
  'Укладываю смысл в удобочитаемую форму…',
  'Примеряю формулировки, как костюмы…',
  'Даю словам правильный вес…',
  'Намечаю маршрут: вопрос → решение…',
  'Снимаю пену с черновика…',
  'Тонко настраиваю градус конкретики…',
  'Проверяю, чтобы каждое слово работало…',
  'Собираю ответ так, чтобы не пришлось уточнять…',
  'Расставляю акценты по местам…',
  'Разглаживаю смысловые складки…',
  'Декомпозирую сложность до комфорта…',
  'Кручу мысль до идеальной посадки…',
  'Вычитываю ответ глазами зануды…',
  'Добавляю ясность, убираю магию…',
  'Компилирую идеи в практичный результат…',
  'Собираю полезность по крупицам…',
  'Сверяю направление с вашим запросом…',
  'Переношу умные мысли в простой интерфейс…',
  'Строю ответ без острых углов…',
  'Расчищаю путь к главному выводу…',
  'Привожу аргументы к стройному виду…',
  'Включаю режим «лаконично, но ёмко»…',
  'Собираю идеальный черновик за кадром…',
  'Проверяю ответ на дружелюбность…',
  'Упаковываю суть в удобный формат…',
] as const

const typedLoaderText = ref('')
const loaderCursorVisible = ref(true)
const currentLoaderPhrase = ref('')
const previousLoaderPhraseIndex = ref<number | null>(null)

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % maxExclusive
}

function pickRandomLoaderPhrase(): string {
  if (LOADING_PHRASES.length === 1) return LOADING_PHRASES[0]
  let nextIndex = randomInt(LOADING_PHRASES.length)
  while (nextIndex === previousLoaderPhraseIndex.value) {
    nextIndex = randomInt(LOADING_PHRASES.length)
  }
  previousLoaderPhraseIndex.value = nextIndex
  return LOADING_PHRASES[nextIndex]
}

function clearLoaderTypeTimer() {
  if (!loadingTypeTimer) return
  clearTimeout(loadingTypeTimer)
  loadingTypeTimer = null
}

function runLoaderTypingCycle() {
  const typeForward = () => {
    const nextLength = typedLoaderText.value.length + 1
    typedLoaderText.value = currentLoaderPhrase.value.slice(0, nextLength)
    if (nextLength < currentLoaderPhrase.value.length) {
      loadingTypeTimer = setTimeout(typeForward, 38 + randomInt(30))
      return
    }
    loadingTypeTimer = setTimeout(typeBackward, 1200 + randomInt(800))
  }

  const typeBackward = () => {
    const nextLength = Math.max(typedLoaderText.value.length - 1, 0)
    typedLoaderText.value = currentLoaderPhrase.value.slice(0, nextLength)
    if (nextLength > 0) {
      loadingTypeTimer = setTimeout(typeBackward, 22 + randomInt(20))
      return
    }
    currentLoaderPhrase.value = pickRandomLoaderPhrase()
    loadingTypeTimer = setTimeout(typeForward, 180 + randomInt(220))
  }

  currentLoaderPhrase.value = pickRandomLoaderPhrase()
  typedLoaderText.value = ''
  clearLoaderTypeTimer()
  loadingTypeTimer = setTimeout(typeForward, 120)
}

function stopLoaderTypingCycle() {
  clearLoaderTypeTimer()
  typedLoaderText.value = ''
}

function startStatusWatch(inst: Chat<UIMessage>) {
  if (statusInterval) clearInterval(statusInterval)
  statusInterval = setInterval(() => {
    chatStatus.value = inst.status
    chatMessages.value = inst.messages
  }, 100)
}

async function initChat() {
  if (!isConfigured.value) return
  const inst = await createChat()
  chatInst.value = inst
  chatMessages.value = inst.messages
  startStatusWatch(inst)
}

async function resetChat() {
  if (statusInterval) clearInterval(statusInterval)
  statusInterval = null
  chatInst.value = null
  chatMessages.value = [makeGreeting()]
  chatStatus.value = 'ready'
  if (isConfigured.value) {
    const inst = await createChat()
    chatInst.value = inst
    chatMessages.value = inst.messages
    startStatusWatch(inst)
  }
}

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
  if (saveTimer) clearTimeout(saveTimer)
  if (sourceSaveTimer) clearTimeout(sourceSaveTimer)
  clearLoaderTypeTimer()
  clearUpdateBriefProgressTimer()
})

if (isConfigured.value) void initChat()

watch(isConfigured, (configured) => {
  if (configured && !chatInst.value) void initChat()
})

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !isConfigured.value) return
  inputText.value = ''
  if (!chatInst.value) void initChat()
  const inst = chatInst.value
  if (!inst) return
  if (inst.status === 'streaming' || inst.status === 'submitted') return
  inst.sendMessage({ text }).catch((e: unknown) => {
    console.error('Analytics chat error:', e)
  })
  await nextTick()
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
}

function stopMessage() {
  const inst = chatInst.value
  if (!inst) return
  inst.stop()
}

watch(
  chatMessages,
  () => { nextTick(() => messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })) },
  { deep: true },
)

// ── Update brief from chat ────────────────────────────────────────────────────

const isUpdatingBrief = ref(false)
const isGeneratingDesign = ref(false)
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
    const current = updateBriefProgress.value
    const cap = 87
    if (current >= cap) {
      updateBriefProgressTimer = setTimeout(tick, 420 + randomInt(520))
      return
    }
    const step = current < 20 ? 2 : current < 55 ? 1 : randomInt(2)
    updateBriefProgress.value = Math.min(cap, current + step)
    updateBriefProgressTimer = setTimeout(tick, 180 + randomInt(420))
  }

  updateBriefProgressTimer = setTimeout(tick, 160)
}

function finishUpdateBriefProgress(): Promise<void> {
  clearUpdateBriefProgressTimer()
  return new Promise((resolve) => {
    const rush = () => {
      const current = updateBriefProgress.value
      if (current >= 100) {
        resolve()
        return
      }
      const remaining = 100 - current
      const step = remaining > 35 ? 9 : remaining > 18 ? 6 : remaining > 8 ? 4 : 2
      updateBriefProgress.value = Math.min(100, current + step)
      updateBriefProgressTimer = setTimeout(rush, 24 + randomInt(30))
    }
    updateBriefProgressTimer = setTimeout(rush, 10)
  })
}

function getText(msg: UIMessage): string {
  for (const part of msg.parts ?? []) {
    if ((part as Record<string, unknown>).type === 'text') {
      return (part as { type: string; text: string }).text
    }
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

async function updateBriefFromChat() {
  if (!isConfigured.value || chatMessages.value.length < 2) return
  isUpdatingBrief.value = true
  startUpdateBriefProgress()
  try {
    const isLMStudio = providerID.value === 'lm-studio'
    const context = chatMessages.value
      .map(m => `${m.role === 'user' ? 'Пользователь' : 'AI'}: ${getText(m)}`)
      .join('\n')

    const currentBrief = BRIEF_SECTIONS
      .map(s => `## ${s.title}\n${briefContent.value[s.id] || '(пусто)'}`)
      .join('\n\n')

    const prompt =
      `Диалог:\n${context}\n\nТекущий бриф:\n${currentBrief}\n\n` +
      `На основе диалога обнови бриф. Заполни все разделы, которые можно вывести из диалога. ` +
      `Для разделов без данных оставь пустую строку. ` +
      `Верни ТОЛЬКО валидный JSON без markdown-блоков:\n` +
      `{"task":"...","users":"...","scenarios":"...","states":"...","constraints":"...","metrics":"...","questions":"..."}\n` +
      `Пиши по-русски, кратко и по существу.`

    const agent = new ToolLoopAgent({
      model: createModel(),
      instructions:
        'Ты преобразуешь диалог в JSON-структуру брифа. Возвращай строго валидный JSON-объект без markdown и комментариев.',
      stopWhen: stepCountIs(1),
      maxOutputTokens: isLMStudio ? undefined : 2048,
    })
    const transport = new DirectChatTransport({ agent })
    const docChat = new Chat<UIMessage>({ transport, messages: [] })
    await docChat.sendMessage({ text: prompt })
    await waitForReady(docChat)

    let parsed: Record<string, string> | null = null
    const last = docChat.messages.at(-1)
    if (last) {
      const raw = getText(last)
      parsed = extractBriefJson(raw)
      if (!parsed) {
        const fixerPrompt =
          `Исправь вывод в строго валидный JSON-объект без markdown и без пояснений.\n` +
          `Используй схему:\n` +
          `{"task":"...","users":"...","scenarios":"...","states":"...","constraints":"...","metrics":"...","questions":"..."}\n\n` +
          `Твой предыдущий вывод:\n${raw}`
        await docChat.sendMessage({ text: fixerPrompt })
        await waitForReady(docChat)
        const fixed = docChat.messages.at(-1)
        if (fixed) parsed = extractBriefJson(getText(fixed))
      }
    }

    if (parsed) {
      for (const s of BRIEF_SECTIONS) {
        if (parsed[s.id]?.trim()) {
          briefContent.value[s.id] = parsed[s.id]
        }
      }
    } else {
      toast.warning('Не удалось автоматически применить бриф из ответа AI. Нажмите "Обновить бриф".')
    }
  } catch (e) {
    console.error('Update brief error:', e)
  } finally {
    await finishUpdateBriefProgress()
    clearUpdateBriefProgressTimer()
    isUpdatingBrief.value = false
  }
}

function buildImplementationReadyDoc(): string {
  const sections = [
    '# Implementation Ready',
    '',
    '## Source',
    analyticsSource.value || '(not provided)',
    '',
    '## Analytics Brief',
    briefToMd(),
    '',
    '## Ready For Engineering',
    '### Functional Scope',
    briefContent.value.task || '(tbd)',
    '',
    '### User Story',
    briefContent.value.users || '(tbd)',
    '',
    '### Main Scenarios',
    briefContent.value.scenarios || '(tbd)',
    '',
    '### States',
    briefContent.value.states || '(tbd)',
    '',
    '### Constraints',
    briefContent.value.constraints || '(tbd)',
    '',
    '### Metrics',
    briefContent.value.metrics || '(tbd)',
    '',
    '### Open Questions',
    briefContent.value.questions || '(none)',
    '',
  ]
  return sections.join('\n')
}

async function generateImplementationReadyDoc() {
  implementationReady.value = buildImplementationReadyDoc()
  if (!workspacePath.value || !projectContext.value) return
  const { productId, screenId, featureId } = projectContext.value
  await writeFeatureFile(
    workspacePath.value,
    productId,
    screenId,
    featureId,
    'implementation-ready.md',
    implementationReady.value,
  )
}

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
      await generateImplementationReadyDoc()
    } else {
      implementationReady.value = buildImplementationReadyDoc()
    }

    const analyticsMd = briefToMd()
    const analyticsSourceMd = analyticsSource.value
    const implementationReadyMd = implementationReady.value
    const validation = validateAnalyticsDesignSources({
      analyticsMd,
      analyticsSourceMd,
      implementationReadyMd,
    })
    if (!validation.ok) {
      toast.error(validation.message)
      return
    }

    const designPrompt = [
      'Собери макет экрана на канвасе на основе текущей аналитики.',
      'Используй ТОЛЬКО данные ниже как source of truth.',
      'Работай execution-first: сначала инструменты, потом краткий ответ.',
      'Рекомендуемый порядок: get_components() -> render() -> create_instance() -> set_layout/batch_update -> describe().',
      'После сборки кратко по-русски опиши: какой экран собран, какие блоки и состояния покрыты.',
      '',
      '# analytics.md',
      analyticsMd,
      '',
      '# analytics-source.md',
      analyticsSourceMd,
      '',
      '# implementation-ready.md',
      implementationReadyMd,
    ].join('\n')

    const designChat = await ensureChat('editor')
    if (!designChat) {
      toast.error('Не удалось инициализировать чат дизайна')
      return
    }

    await router.push('/workspace/design')
    await designChat.sendMessage({ text: designPrompt })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.error(`Не удалось сгенерировать дизайн: ${message}`)
  } finally {
    isGeneratingDesign.value = false
  }
}

const isChatBusy = computed(() => chatStatus.value === 'streaming' || chatStatus.value === 'submitted')
const showLoader = computed(() => chatStatus.value === 'submitted')
watch(showLoader, (active) => {
  if (active) {
    runLoaderTypingCycle()
    return
  }
  stopLoaderTypingCycle()
}, { immediate: true })

let loaderCursorBlinkInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  loaderCursorBlinkInterval = setInterval(() => {
    loaderCursorVisible.value = !loaderCursorVisible.value
  }, 460)
})
onUnmounted(() => {
  if (!loaderCursorBlinkInterval) return
  clearInterval(loaderCursorBlinkInterval)
  loaderCursorBlinkInterval = null
})

const canSuggestVariants = computed(() => isConfigured.value && !isChatBusy.value)
const canSend = computed(() => inputText.value.trim().length > 0 && isConfigured.value && !isChatBusy.value)
const canSaveBrief = computed(() => Boolean(workspacePath.value && projectContext.value) && !savingBrief.value)

async function copyMessage(msg: UIMessage) {
  const text = getText(msg).trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast.info('Сообщение скопировано')
  } catch (error) {
    console.error('Copy message error:', error)
    toast.error('Не удалось скопировать сообщение')
  }
}

async function suggestVariants() {
  if (!canSuggestVariants.value) return
  if (!chatInst.value) await initChat()
  const inst = chatInst.value
  if (!inst) return

  const prompt = [
    'Норка, предложи варианты ответов на вопросы, которые ты сама задала в текущем диалоге.',
    'Если в последнем сообщении ассистента есть вопросы — ответь именно на них.',
    'Формат ответа:',
    '1) Коротко перечисли найденные вопросы.',
    '2) Для каждого вопроса дай 3-5 реалистичных вариантов ответа, применимых к продуктовой аналитике и UX.',
    '3) Отметь рекомендуемый вариант и почему.',
    '4) Если в диалоге нет явных вопросов, предложи 5 ключевых уточнений для разделов: Пользователь, Сценарии, Состояния, Ограничения, Метрики.',
    'Пиши по-русски, кратко и практично.',
  ].join('\n')

  inst.sendMessage({ text: prompt }).catch((e: unknown) => {
    console.error('Suggest variants error:', e)
  })
  await nextTick()
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div class="flex h-full w-full select-text flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <icon-lucide-brain-circuit class="size-3.5 text-accent" />
      <span class="text-xs font-medium text-surface">Аналитика</span>

      <div class="h-4 w-px bg-border" />

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
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="generateImplementationReadyDoc"
      >
        <icon-lucide-file-check-2 class="size-3.5" />
        Implementation-ready
      </button>
      <button
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="fillDemoData"
      >
        <icon-lucide-flask-conical class="size-3.5" />
        Демо
      </button>
      <button
          :disabled="!isConfigured || isChatBusy || isGeneratingDesign"
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        :class="isGeneratingDesign ? 'text-accent' : 'text-muted hover:bg-hover hover:text-surface'"
        @click="generateDesignFromAnalytics"
      >
        <icon-lucide-loader-circle v-if="isGeneratingDesign" class="size-3.5 animate-spin" />
        <icon-lucide-wand-sparkles v-else class="size-3.5" />
        {{ isGeneratingDesign ? 'Собираю дизайн…' : 'В дизайн через LLM' }}
      </button>

      <div class="flex-1" />

      <span v-if="saveStatusLabel" class="text-[10px] text-muted">{{ saveStatusLabel }}</span>

      <div class="h-4 w-px bg-border" />

      <button
        class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="resetChat"
      >
        <icon-lucide-rotate-ccw class="size-3.5" />
        Сбросить чат
      </button>
    </header>

    <SplitterGroup direction="horizontal" auto-save-id="analytics-layout" class="flex-1 overflow-hidden">
      <!-- Left: Chat -->
      <SplitterPanel :default-size="55" :min-size="35" class="relative flex flex-col overflow-hidden bg-canvas">
        <!-- AI not configured banner -->
        <div
          v-if="!isConfigured"
          class="m-4 flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center"
        >
          <icon-lucide-bot class="size-8 text-amber-400" />
          <p class="text-sm font-medium text-surface">Нужно настроить AI</p>
          <p class="text-xs text-muted">
            Настройте подключение к AI-провайдеру, чтобы начать диалог с ассистентом.
          </p>
          <button
            class="mt-1 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/80"
            @click="settings.show()"
          >
            <icon-lucide-settings class="size-3.5" />
            Настроить AI
          </button>
        </div>

        <!-- Messages -->
        <ScrollAreaRoot class="min-h-0 flex-1">
          <ScrollAreaViewport class="h-full min-h-0 overflow-y-auto px-4 py-4">
            <div class="flex flex-col gap-4">
              <div
                v-for="msg in chatMessages"
                :key="msg.id"
                class="flex gap-3"
                :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
              >
                <div
                  class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="msg.role === 'assistant' ? 'bg-accent/20 text-accent' : 'bg-muted/20 text-muted'"
                >
                  {{ msg.role === 'assistant' ? 'AI' : 'Я' }}
                </div>
                <div
                  class="max-w-[75%] rounded-2xl px-4 py-2.5"
                  :class="
                    msg.role === 'assistant'
                      ? 'rounded-tl-sm bg-panel text-surface'
                      : 'rounded-tr-sm bg-accent/15 text-surface'
                  "
                >
                  <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ getText(msg) }}</p>
                </div>
                <button
                  class="mt-1 flex size-6 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
                  @click="copyMessage(msg)"
                >
                  <icon-lucide-copy class="size-3.5" />
                </button>
              </div>

              <!-- Streaming indicator -->
              <div v-if="showLoader" class="flex gap-3">
                <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                  AI
                </div>
                <div class="flex min-h-[46px] items-center rounded-2xl rounded-tl-sm bg-panel px-4 py-3">
                  <span class="text-sm leading-relaxed text-surface/90">
                    {{ typedLoaderText }}
                    <span
                      class="inline-block w-[0.5ch] text-accent transition-opacity duration-150"
                      :class="loaderCursorVisible ? 'opacity-100' : 'opacity-10'"
                    >
                      |
                    </span>
                  </span>
                </div>
              </div>

              <div ref="messagesEndRef" />
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>

        <!-- Input -->
        <div class="shrink-0 border-t border-border p-3">
          <div class="flex items-end gap-2 rounded-xl border border-border bg-panel px-3 py-2 transition-colors focus-within:border-accent/50">
            <textarea
              v-model="inputText"
              rows="2"
              :disabled="!isConfigured || isChatBusy"
              :placeholder="isConfigured ? 'Ответьте на вопрос AI…' : 'Сначала настройте AI'"
              class="flex-1 resize-none bg-transparent text-sm text-surface outline-none placeholder:text-muted disabled:opacity-50"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <button
              :disabled="!canSuggestVariants"
              class="rounded-lg border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-40"
              @click="suggestVariants"
            >
              Предложи варианты
            </button>
            <button
              :disabled="isChatBusy ? false : !canSend"
              class="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
              :class="
                isChatBusy
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : canSend
                    ? 'bg-accent text-white hover:bg-accent/80'
                    : 'bg-hover text-muted'
              "
              :title="isChatBusy ? 'Остановить ответ AI' : 'Отправить'"
              @click="isChatBusy ? stopMessage() : sendMessage()"
            >
              <icon-lucide-square v-if="isChatBusy" class="size-3.5" />
              <icon-lucide-arrow-up v-else class="size-4" />
            </button>
          </div>
          <p class="mt-1 text-[10px] text-muted">Enter — отправить · Shift+Enter — новая строка</p>
        </div>

        <div
          v-if="isUpdatingBrief"
          class="absolute inset-x-0 bottom-0 top-0 z-20 flex flex-col bg-canvas/70 backdrop-blur-[1px]"
        >
          <div class="min-h-0 flex-1" />
          <div class="mx-4 mb-4 rounded-xl border border-border bg-panel/95 px-4 py-3 shadow-lg">
            <div class="flex items-center gap-2">
              <icon-lucide-loader-circle class="size-4 animate-spin text-accent" />
              <span class="text-xs font-medium text-surface">Анализирую диалог и заполняю блоки… {{ updateBriefProgress }}%</span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-hover">
              <div
                class="h-full rounded-full bg-accent/80 transition-[width] duration-150 ease-out"
                :style="{ width: `${updateBriefProgress}%` }"
              />
            </div>
          </div>
        </div>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Right: Brief editor -->
      <SplitterPanel
        :default-size="45"
        :min-size="28"
        :max-size="60"
        class="flex flex-col overflow-hidden border-l border-border"
      >
        <!-- Panel header -->
        <div class="flex shrink-0 items-center gap-2 border-b border-border bg-panel px-3 py-2">
          <icon-lucide-file-text class="size-3.5 shrink-0 text-accent" />
          <span class="flex-1 text-xs font-medium text-surface">analytics.md</span>
          <button
            :disabled="!isConfigured || chatMessages.length < 2 || isUpdatingBrief"
            class="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-muted transition-colors hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-40"
            @click="updateBriefFromChat"
          >
            <icon-lucide-loader-circle v-if="isUpdatingBrief" class="size-3 animate-spin" />
            <icon-lucide-sparkles v-else class="size-3" />
            {{ isUpdatingBrief ? `Обновляю (${updateBriefProgress}%)` : 'Проанализировать диалог и заполнить блоки' }}
          </button>
          <Tip label="Скопировать markdown">
            <button
              class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="navigator.clipboard.writeText(briefToMd())"
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

        <!-- Sections -->
        <ScrollAreaRoot class="flex-1 bg-canvas">
          <ScrollAreaViewport class="h-full">
            <div class="flex flex-col divide-y divide-border/60">
              <div class="flex flex-col">
                <div class="bg-panel/60 px-3 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Источник аналитики (Confluence)
                  </span>
                  <span class="ml-2 text-[10px] text-muted">{{ savingSource ? 'Сохраняю…' : sourceDirty ? 'Не сохранено' : 'Сохранено' }}</span>
                </div>
                <textarea
                  v-model="analyticsSource"
                  placeholder="Вставьте сюда source-аналитику и ссылку на Confluence"
                  class="min-h-[92px] resize-none bg-canvas px-3 py-2.5 text-sm leading-relaxed text-surface outline-none placeholder:text-muted/40 focus:bg-hover/20"
                  style="field-sizing: content"
                />
              </div>
              <div
                v-for="section in BRIEF_SECTIONS"
                :key="section.id"
                class="flex flex-col"
              >
                <div class="bg-panel/60 px-3 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {{ section.title }}
                  </span>
                </div>
                <textarea
                  v-model="briefContent[section.id]"
                  :placeholder="`${section.title}…`"
                  class="min-h-[72px] resize-none bg-canvas px-3 py-2.5 text-sm leading-relaxed text-surface outline-none placeholder:text-muted/40 focus:bg-hover/20"
                  :class="section.id === 'users' ? 'max-h-56 overflow-y-auto' : ''"
                  style="field-sizing: content"
                />
              </div>
              <div class="flex flex-col">
                <div class="bg-panel/60 px-3 py-1.5">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    implementation-ready.md
                  </span>
                </div>
                <textarea
                  v-model="implementationReady"
                  placeholder="Сформируйте implementation-ready документ кнопкой сверху"
                  class="min-h-[140px] resize-none bg-canvas px-3 py-2.5 font-mono text-xs leading-relaxed text-surface outline-none placeholder:text-muted/40 focus:bg-hover/20"
                  style="field-sizing: content"
                />
              </div>
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
