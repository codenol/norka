<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport, SplitterGroup, SplitterPanel, SplitterResizeHandle, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import { toast } from '@/utils/toast'
import { useProjects } from '@/composables/use-projects'
import { useWorkspaceFs, writeFeatureFile, readFeatureFile } from '@/composables/use-workspace-fs'

const { context, workspacePath } = useProjects()
const { isDesktop } = useWorkspaceFs()

// ── Concept code preview ──────────────────────────────────────────────────────

const conceptCode = ref('')
const finalExport = ref('')

async function loadConceptCode() {
  if (!workspacePath.value || !context.value) return
  const { productId, screenId, featureId } = context.value
  conceptCode.value = await readFeatureFile(workspacePath.value, productId, screenId, featureId, 'concept.tsx')
}

async function saveHandoffMd() {
  if (!workspacePath.value || !context.value) {
    toast.error('Нет рабочей папки или контекста фичи')
    return
  }
  const lines: string[] = ['# Handoff\n']
  for (const section of docSections.value) {
    lines.push(`## ${section.title}\n`)
    lines.push(section.content)
    lines.push('')
  }
  if (specRows.length) {
    lines.push('## Спецификации\n')
    lines.push('| Компонент | Свойство | Значение |')
    lines.push('|-----------|----------|----------|')
    for (const row of specRows) {
      lines.push(`| ${row.component} | ${row.property} | ${row.value} |`)
    }
    lines.push('')
  }
  if (resourceLinks.length) {
    lines.push('## Ресурсы\n')
    for (const link of resourceLinks) {
      lines.push(`- [${link.label}](${link.url})`)
    }
    lines.push('')
  }
  const { productId, screenId, featureId } = context.value
  await writeFeatureFile(workspacePath.value, productId, screenId, featureId, 'handoff.md', lines.join('\n'))
  toast.success('handoff.md сохранён')
}

async function generateFinalExportMd() {
  if (!workspacePath.value || !context.value) {
    toast.error('Нет рабочей папки или контекста фичи')
    return
  }
  const { productId, screenId, featureId } = context.value
  const [sourceAnalytics, implementationReady, previewLayout, commentsRaw] = await Promise.all([
    readFeatureFile(workspacePath.value, productId, screenId, featureId, 'analytics-source.md'),
    readFeatureFile(workspacePath.value, productId, screenId, featureId, 'implementation-ready.md'),
    readFeatureFile(workspacePath.value, productId, screenId, featureId, 'preview-layout.json'),
    readFeatureFile(workspacePath.value, productId, screenId, featureId, 'comments.json'),
  ])
  const lines: string[] = [
    '# Final Prototype Export',
    '',
    '## Source Analytics',
    sourceAnalytics || '(not provided)',
    '',
    '## Implementation Ready',
    implementationReady || '(not generated)',
    '',
    '## Prototype Snapshot',
    '```json',
    previewLayout || '{}',
    '```',
    '',
    '## Review Summary',
    commentsRaw || '[]',
    '',
    '## Auto Screenshots',
    '- ![Main state](./screenshots/main.png)',
    '- ![Empty state](./screenshots/empty.png)',
    '- ![Error state](./screenshots/error.png)',
    '',
  ]
  finalExport.value = lines.join('\n')
  await writeFeatureFile(
    workspacePath.value,
    productId,
    screenId,
    featureId,
    'final-export.md',
    finalExport.value,
  )
  toast.success('final-export.md сохранён')
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3

interface Feature {
  id: string
  name: string
  selected: boolean
}

interface DocSection {
  id: string
  title: string
  content: string
  expanded: boolean
}

interface SpecRow {
  component: string
  property: string
  value: string
}

interface ResourceLink {
  id: string
  label: string
  url: string
  icon: string
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const features = ref<Feature[]>([
  { id: 'f1', name: 'Онбординг — шаг 1', selected: true },
  { id: 'f2', name: 'Онбординг — шаг 2', selected: false },
  { id: 'f3', name: 'Создание проекта', selected: false },
  { id: 'f4', name: 'Приглашение коллег', selected: false },
  { id: 'f5', name: 'Главный экран', selected: false },
])

const docSections = ref<DocSection[]>([
  { id: 'ds1', title: 'Описание', expanded: true, content: 'Первый шаг онбординга. Пользователь видит приветственный экран с ключевыми преимуществами продукта. Цель — мотивировать продолжить и не уйти.' },
  { id: 'ds2', title: 'Компоненты', expanded: false, content: '• Hero-блок (иллюстрация + заголовок + подзаголовок)\n• Button/Primary — "Начать →"\n• Button/Text — "Пропустить"\n• ProgressBar (шаг 1 из 5)' },
  { id: 'ds3', title: 'Взаимодействия', expanded: false, content: '• Кнопка "Начать" → переход к шагу 2 с анимацией slide-left\n• Кнопка "Пропустить" → показ подтверждения\n• Свайп влево (mobile) = "Начать"' },
  { id: 'ds4', title: 'Состояния', expanded: false, content: '• Default — стандартный вид\n• Loading — если загружается профиль пользователя\n• Error — если не удалось загрузить данные' },
])

const specRows: SpecRow[] = [
  { component: 'Hero', property: 'Отступ сверху', value: '64px' },
  { component: 'Hero', property: 'Иллюстрация', value: '240 × 200 px' },
  { component: 'Заголовок', property: 'Font size', value: '28px / Bold' },
  { component: 'Заголовок', property: 'Color', value: 'Neutral/900' },
  { component: 'Подзаголовок', property: 'Font size', value: '15px / Regular' },
  { component: 'Подзаголовок', property: 'Color', value: 'Neutral/500' },
  { component: 'Button/Primary', property: 'Height', value: '48px' },
  { component: 'Button/Primary', property: 'Color', value: 'Primary/500' },
  { component: 'ProgressBar', property: 'Progress', value: '20% (1/5)' },
]

const resourceLinks: ResourceLink[] = [
  { id: 'l1', label: 'Дизайн-файл Nork', url: '#', icon: 'pen-tool' },
  { id: 'l2', label: 'Storybook компоненты', url: '#', icon: 'book-open' },
  { id: 'l3', label: 'GitHub PR #142', url: '#', icon: 'git-pull-request' },
  { id: 'l4', label: 'Confluence: Онбординг', url: '#', icon: 'file-text' },
]

// ── State ─────────────────────────────────────────────────────────────────────

const currentStep = ref<Step>(1)
const isGenerating = ref(false)
const activeFeatureId = ref('f1')
const activeDocTab = ref('documentation')

const activeFeature = computed(() =>
  features.value.find(f => f.id === activeFeatureId.value)
)

const stepLabels: Record<Step, string> = {
  1: 'Подготовка',
  2: 'Ревью',
  3: 'Шеринг',
}

async function handleCta() {
  if (currentStep.value === 1) {
    isGenerating.value = true
    await new Promise(r => setTimeout(r, 1500))
    isGenerating.value = false
    docSections.value.forEach(s => { s.expanded = true })
    currentStep.value = 2
    toast.info('Документация сгенерирована')
  } else if (currentStep.value === 2) {
    currentStep.value = 3
    toast.info('Документация утверждена')
  } else {
    toast.info('Ссылка скопирована: norka.app/handoff/abc123')
  }
}

function toggleDocSection(id: string) {
  const s = docSections.value.find(s => s.id === id)
  if (s) s.expanded = !s.expanded
}

const progressWidth = computed(() => {
  const map: Record<Step, string> = { 1: '0%', 2: '50%', 3: '100%' }
  return map[currentStep.value]
})

onMounted(async () => {
  await loadConceptCode()
  if (!workspacePath.value || !context.value) return
  const { productId, screenId, featureId } = context.value
  finalExport.value = await readFeatureFile(workspacePath.value, productId, screenId, featureId, 'final-export.md')
})
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <!-- Top bar: stepper -->
    <header class="flex h-10 shrink-0 items-center gap-3 border-b border-border px-4">
      <!-- Steps -->
      <div class="flex items-center gap-2">
        <template v-for="step in [1, 2, 3] as Step[]" :key="step">
          <div
            class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
            :class="currentStep === step
              ? 'bg-accent/15 text-accent'
              : currentStep > step
                ? 'text-emerald-400'
                : 'text-muted'"
          >
            <icon-lucide-check v-if="currentStep > step" class="size-3" />
            <span v-else class="flex size-4 items-center justify-center rounded-full border text-[10px]"
              :class="currentStep === step ? 'border-accent text-accent' : 'border-border text-muted'"
            >{{ step }}</span>
            {{ stepLabels[step as Step] }}
          </div>
          <icon-lucide-chevron-right v-if="step < 3" class="size-3 shrink-0 text-border" />
        </template>
      </div>

      <div class="flex-1" />

      <!-- CTA -->
      <button
        class="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        :class="currentStep === 1
          ? 'bg-accent text-white hover:bg-accent/80'
          : currentStep === 2
            ? 'bg-emerald-600 text-white hover:bg-emerald-600/80'
            : 'bg-hover text-surface hover:bg-hover/80'"
        :disabled="isGenerating"
        @click="handleCta"
      >
        <icon-lucide-loader-circle v-if="isGenerating" class="size-3.5 animate-spin" />
        <icon-lucide-file-search v-else-if="currentStep === 1" class="size-3.5" />
        <icon-lucide-check v-else-if="currentStep === 2" class="size-3.5" />
        <icon-lucide-link v-else class="size-3.5" />

        <span>{{
          isGenerating ? 'Генерация…' :
          currentStep === 1 ? 'Сгенерировать документацию' :
          currentStep === 2 ? 'Утвердить и продолжить' :
          'Скопировать ссылку'
        }}</span>
      </button>

      <template v-if="isDesktop">
        <div class="h-4 w-px bg-border" />
        <button
          class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="saveHandoffMd"
        >
          <icon-lucide-save class="size-3.5" />
          handoff.md
        </button>
        <button
          class="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="generateFinalExportMd"
        >
          <icon-lucide-file-down class="size-3.5" />
          final-export.md
        </button>
      </template>
    </header>

    <!-- Body -->
    <SplitterGroup direction="horizontal" auto-save-id="handoff-layout" class="flex-1 overflow-hidden">
      <!-- Left: Feature list + progress -->
      <SplitterPanel :default-size="20" :min-size="14" :max-size="30" class="flex flex-col overflow-hidden border-r border-border bg-panel">
        <header class="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted">Задачи</header>
        <ScrollAreaRoot class="flex-1">
          <ScrollAreaViewport class="h-full px-2 pb-2">
            <div class="flex flex-col gap-0.5">
              <button
                v-for="feature in features"
                :key="feature.id"
                class="flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors"
                :class="activeFeatureId === feature.id
                  ? 'bg-hover text-surface'
                  : 'text-muted hover:bg-hover/70 hover:text-surface'"
                @click="activeFeatureId = feature.id"
              >
                <div
                  class="flex size-4 shrink-0 items-center justify-center rounded border transition-colors"
                  :class="feature.selected ? 'border-accent bg-accent/20' : 'border-border'"
                  @click.stop="feature.selected = !feature.selected"
                >
                  <icon-lucide-check v-if="feature.selected" class="size-2.5 text-accent" />
                </div>
                <span class="truncate text-xs">{{ feature.name }}</span>
              </button>
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
            <ScrollAreaThumb class="rounded-full bg-border" />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>

        <!-- Progress -->
        <div class="shrink-0 border-t border-border p-3">
          <div class="mb-1 flex items-center justify-between">
            <span class="text-[11px] text-muted">Прогресс</span>
            <span class="text-[11px] font-medium text-surface">{{ { 1: '0%', 2: '50%', 3: '100%' }[currentStep] }}</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-hover">
            <div
              class="h-full rounded-full bg-accent transition-all duration-700"
              :style="{ width: progressWidth }"
            />
          </div>
        </div>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Center: Annotated canvas -->
      <SplitterPanel :default-size="50" :min-size="28" class="relative flex flex-col overflow-hidden bg-canvas">
        <div class="relative flex flex-1 items-center justify-center overflow-hidden p-8">
          <!-- Mock artboard -->
          <div class="relative flex h-full w-full max-h-[580px] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-border/50 bg-panel/80 shadow-2xl">
            <!-- Artboard label -->
            <div class="absolute -top-6 left-0 text-[11px] text-muted">{{ activeFeature?.name }}</div>

            <!-- Mock screen content -->
            <div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <!-- Illustration placeholder -->
              <div class="relative h-32 w-full">
                <div class="h-32 w-full rounded-xl bg-accent/10" />
                <!-- Width annotation (step 1 only) -->
                <template v-if="currentStep === 1">
                  <div class="absolute -bottom-5 left-0 right-0 flex items-center gap-1 text-[10px] text-red-400">
                    <div class="h-px flex-1 bg-red-400" />
                    <span>320px</span>
                    <div class="h-px flex-1 bg-red-400" />
                  </div>
                  <div class="absolute -right-8 top-0 bottom-0 flex flex-col items-center gap-1 text-[10px] text-red-400">
                    <div class="w-px flex-1 bg-red-400" />
                    <span class="-rotate-90 whitespace-nowrap">128px</span>
                    <div class="w-px flex-1 bg-red-400" />
                  </div>
                </template>
              </div>

              <!-- Title -->
              <div class="relative w-full text-center">
                <div class="h-7 w-full rounded bg-surface/20" />
                <template v-if="currentStep === 1">
                  <div class="absolute -right-16 top-0 rounded border border-accent/40 bg-canvas px-1.5 py-0.5 text-[9px] text-accent">H1 / Bold</div>
                </template>
              </div>

              <div class="h-4 w-4/5 rounded bg-surface/10" />
              <div class="h-4 w-3/5 rounded bg-surface/10" />

              <!-- CTA button -->
              <div class="relative mt-4 w-full">
                <div class="flex h-12 w-full items-center justify-center rounded-xl bg-accent/30">
                  <span class="text-xs font-medium text-accent">Начать →</span>
                </div>
                <template v-if="currentStep === 1">
                  <div class="absolute -bottom-5 left-0 right-0 flex items-center gap-1 text-[10px] text-red-400">
                    <div class="h-px flex-1 bg-red-400" />
                    <span>48px</span>
                    <div class="h-px flex-1 bg-red-400" />
                  </div>
                </template>
              </div>

              <!-- Progress dots -->
              <div class="mt-4 flex gap-1.5">
                <div v-for="i in 5" :key="i" class="size-1.5 rounded-full" :class="i === 1 ? 'bg-accent' : 'bg-muted/30'" />
              </div>
            </div>
          </div>

          <!-- Step 2: Review overlay -->
          <div
            v-if="currentStep === 2"
            class="absolute inset-0 flex items-start justify-center pt-4 pointer-events-none"
          >
            <div class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
              Review mode
            </div>
          </div>

          <!-- Step 3: Shared overlay -->
          <div
            v-if="currentStep === 3"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas/60 backdrop-blur-sm"
          >
            <icon-lucide-check-circle class="size-12 text-emerald-400" />
            <p class="text-sm font-medium text-surface">Документация опубликована</p>
            <p class="text-xs text-muted">norka.app/handoff/abc123</p>
          </div>
        </div>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Right: Documentation -->
      <SplitterPanel :default-size="30" :min-size="22" :max-size="42" class="flex flex-col overflow-hidden border-l border-border bg-panel">
        <TabsRoot v-model="activeDocTab" class="flex h-full flex-col overflow-hidden">
          <TabsList class="flex shrink-0 border-b border-border">
            <TabsTrigger
              v-for="(label, value) in { documentation: 'Документация', specifications: 'Спецификации', links: 'Ссылки', code: 'Код', export: 'Экспорт' }"
              :key="value"
              :value="value"
              class="flex-1 border-b-2 border-transparent px-2 py-2 text-[11px] transition-colors data-[state=active]:border-accent data-[state=active]:text-accent"
              :class="activeDocTab === value ? 'text-accent' : 'text-muted hover:text-surface'"
            >
              {{ label }}
            </TabsTrigger>
          </TabsList>

          <!-- Documentation tab -->
          <TabsContent value="documentation" class="flex flex-1 flex-col overflow-hidden">
            <div
              v-if="currentStep === 1 && !isGenerating"
              class="flex flex-1 flex-col items-center justify-center gap-3 text-muted"
            >
              <icon-lucide-file-text class="size-8 opacity-30" />
              <p class="text-center text-xs px-4">Нажмите «Сгенерировать документацию» чтобы создать описание макетов</p>
            </div>
            <div v-else-if="isGenerating" class="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
              <icon-lucide-loader-circle class="size-8 animate-spin opacity-50" />
              <p class="text-xs">Анализирую макеты…</p>
            </div>
            <ScrollAreaRoot v-else class="flex-1">
              <ScrollAreaViewport class="h-full p-3">
                <div class="flex flex-col gap-1">
                  <div
                    v-for="section in docSections"
                    :key="section.id"
                    class="overflow-hidden rounded-lg border border-border"
                  >
                    <button
                      class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hover/50 transition-colors"
                      @click="toggleDocSection(section.id)"
                    >
                      <icon-lucide-chevron-right
                        class="size-3 shrink-0 text-muted transition-transform"
                        :class="section.expanded ? 'rotate-90' : ''"
                      />
                      <span class="text-xs font-medium text-surface">{{ section.title }}</span>
                    </button>
                    <div v-if="section.expanded" class="border-t border-border bg-canvas/40 px-3 py-2">
                      <p class="whitespace-pre-wrap text-xs leading-relaxed text-surface/80">{{ section.content }}</p>
                    </div>
                  </div>
                </div>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
                <ScrollAreaThumb class="rounded-full bg-border" />
              </ScrollAreaScrollbar>
            </ScrollAreaRoot>
          </TabsContent>

          <!-- Specifications tab -->
          <TabsContent value="specifications" class="flex flex-1 flex-col overflow-hidden">
            <ScrollAreaRoot class="flex-1">
              <ScrollAreaViewport class="h-full">
                <table class="w-full">
                  <thead class="sticky top-0 bg-panel">
                    <tr class="border-b border-border">
                      <th class="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted">Компонент</th>
                      <th class="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted">Свойство</th>
                      <th class="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted">Значение</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in specRows"
                      :key="`${row.component}-${row.property}`"
                      class="border-b border-border/50 hover:bg-hover/30 transition-colors"
                    >
                      <td class="px-3 py-1.5 text-xs text-muted">{{ row.component }}</td>
                      <td class="px-3 py-1.5 text-xs text-surface">{{ row.property }}</td>
                      <td class="px-3 py-1.5 font-mono text-xs text-surface/80">{{ row.value }}</td>
                    </tr>
                  </tbody>
                </table>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
                <ScrollAreaThumb class="rounded-full bg-border" />
              </ScrollAreaScrollbar>
            </ScrollAreaRoot>
          </TabsContent>

          <!-- Links tab -->
          <TabsContent value="links" class="flex flex-1 flex-col overflow-hidden">
            <ScrollAreaRoot class="flex-1">
              <ScrollAreaViewport class="h-full p-2">
                <!-- Share link (step 3 only) -->
                <div v-if="currentStep === 3" class="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p class="mb-1.5 text-[11px] font-medium text-emerald-400">Ссылка для разработчика</p>
                  <div class="flex items-center gap-2 rounded border border-border bg-canvas px-2 py-1.5">
                    <span class="flex-1 truncate font-mono text-[11px] text-surface/80">norka.app/handoff/abc123</span>
                    <button
                      class="text-muted hover:text-surface transition-colors"
                      @click="toast.info('Ссылка скопирована!')"
                    >
                      <icon-lucide-copy class="size-3.5" />
                    </button>
                  </div>
                </div>

                <div class="flex flex-col gap-0.5">
                  <a
                    v-for="link in resourceLinks"
                    :key="link.id"
                    href="#"
                    class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-hover"
                    @click.prevent
                  >
                    <component :is="`icon-lucide-${link.icon}`" class="size-4 shrink-0 text-muted" />
                    <span class="flex-1 text-xs text-surface">{{ link.label }}</span>
                    <icon-lucide-external-link class="size-3.5 text-muted" />
                  </a>
                </div>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
                <ScrollAreaThumb class="rounded-full bg-border" />
              </ScrollAreaScrollbar>
            </ScrollAreaRoot>
          </TabsContent>

          <!-- Code tab -->
          <TabsContent value="code" class="flex flex-1 flex-col overflow-hidden">
            <div v-if="!conceptCode" class="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
              <icon-lucide-file-code class="size-8 opacity-30" />
              <p class="text-center text-xs px-4">
                {{ isDesktop ? 'concept.tsx не найден. Сгенерируйте его в шаге Аналитика.' : 'Доступно в десктоп-версии' }}
              </p>
            </div>
            <ScrollAreaRoot v-else class="flex-1">
              <ScrollAreaViewport class="h-full">
                <pre class="p-3 font-mono text-[11px] leading-relaxed text-surface/80 whitespace-pre-wrap break-words">{{ conceptCode }}</pre>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
                <ScrollAreaThumb class="rounded-full bg-border" />
              </ScrollAreaScrollbar>
            </ScrollAreaRoot>
          </TabsContent>

          <TabsContent value="export" class="flex flex-1 flex-col overflow-hidden">
            <div v-if="!finalExport" class="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
              <icon-lucide-file-down class="size-8 opacity-30" />
              <p class="text-center text-xs px-4">Сгенерируйте final-export.md</p>
            </div>
            <ScrollAreaRoot v-else class="flex-1">
              <ScrollAreaViewport class="h-full">
                <pre class="p-3 font-mono text-[11px] leading-relaxed text-surface/80 whitespace-pre-wrap break-words">{{ finalExport }}</pre>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
                <ScrollAreaThumb class="rounded-full bg-border" />
              </ScrollAreaScrollbar>
            </ScrollAreaRoot>
          </TabsContent>
        </TabsRoot>
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
