<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport, SplitterGroup, SplitterPanel, SplitterResizeHandle, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import Tip from '@/components/ui/Tip.vue'
import { toast } from '@/utils/toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type DevicePreset = 'Mobile 390' | 'Tablet 768' | 'Desktop 1280' | 'Fluid'
type Theme = 'dark' | 'light'

interface LogEntry {
  id: string
  time: string
  text: string
  type: 'click' | 'route' | 'input' | 'load'
}

interface ComponentNode {
  id: string
  name: string
  depth: number
  children?: ComponentNode[]
  expanded: boolean
}

interface MockPage {
  id: string
  name: string
  url: string
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_PAGES: MockPage[] = [
  { id: 'p1', name: 'Онбординг — Шаг 1', url: '/onboarding/1' },
  { id: 'p2', name: 'Онбординг — Шаг 2', url: '/onboarding/2' },
  { id: 'p3', name: 'Создание проекта', url: '/project/create' },
  { id: 'p4', name: 'Главный экран', url: '/dashboard' },
  { id: 'p5', name: 'Профиль', url: '/profile' },
]

const COMPONENT_TREE: ComponentNode[] = [
  {
    id: 'cn1', name: 'App', depth: 0, expanded: true, children: [
      {
        id: 'cn2', name: 'Layout', depth: 1, expanded: true, children: [
          { id: 'cn3', name: 'OnboardingScreen', depth: 2, expanded: false, children: [
            { id: 'cn4', name: 'HeroIllustration', depth: 3, expanded: false },
            { id: 'cn5', name: 'Typography/H1', depth: 3, expanded: false },
            { id: 'cn6', name: 'Typography/Body', depth: 3, expanded: false },
            { id: 'cn7', name: 'Button/Primary', depth: 3, expanded: false },
            { id: 'cn8', name: 'Button/Text', depth: 3, expanded: false },
            { id: 'cn9', name: 'ProgressBar', depth: 3, expanded: false },
          ]},
        ],
      },
    ],
  },
]

const DEVICE_PRESETS: DevicePreset[] = ['Mobile 390', 'Tablet 768', 'Desktop 1280', 'Fluid']
const DEVICE_WIDTHS: Record<DevicePreset, number | null> = {
  'Mobile 390': 390,
  'Tablet 768': 768,
  'Desktop 1280': 1280,
  'Fluid': null,
}

const LOG_MESSAGES = [
  { text: 'Button clicked: "Начать →"', type: 'click' as const },
  { text: 'Route change: /onboarding/2', type: 'route' as const },
  { text: 'Input: project name = "Мой проект"', type: 'input' as const },
  { text: 'Button clicked: "Пригласить коллегу"', type: 'click' as const },
  { text: 'Route change: /dashboard', type: 'route' as const },
  { text: 'Button clicked: "+ Новый проект"', type: 'click' as const },
  { text: 'Route change: /project/create', type: 'route' as const },
]

// Mock iframe content — a realistic onboarding screen
const MOCK_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  body { background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { background: white; border-radius: 24px; padding: 40px 32px; max-width: 400px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
  .illustration { width: 100%; height: 160px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 16px; margin-bottom: 32px; display: flex; align-items: center; justify-content: center; }
  .illustration svg { opacity: 0.6; }
  h1 { font-size: 26px; font-weight: 700; color: #0f172a; line-height: 1.3; margin-bottom: 12px; }
  p { font-size: 15px; color: #64748b; line-height: 1.6; margin-bottom: 32px; }
  .btn-primary { width: 100%; height: 48px; background: #3b82f6; color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 12px; transition: background 0.15s; }
  .btn-primary:hover { background: #2563eb; }
  .btn-text { background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; width: 100%; padding: 8px; }
  .btn-text:hover { color: #64748b; }
  .progress { display: flex; gap: 6px; justify-content: center; margin-top: 28px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0; }
  .dot.active { background: #3b82f6; }
</style>
</head>
<body>
<div class="card">
  <div class="illustration">
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="10" y="20" width="60" height="40" rx="8" fill="#3b82f6" opacity="0.3"/>
      <rect x="20" y="30" width="40" height="6" rx="3" fill="#3b82f6" opacity="0.6"/>
      <rect x="20" y="42" width="28" height="4" rx="2" fill="#3b82f6" opacity="0.4"/>
      <circle cx="58" cy="24" r="10" fill="#10b981" opacity="0.5"/>
      <path d="M53 24l3 3 6-6" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    </svg>
  </div>
  <h1>Создайте свой первый проект</h1>
  <p>Nork — инструмент для совместного проектирования. Начните с создания проекта и пригласите команду.</p>
  <button class="btn-primary">Начать →</button>
  <button class="btn-text">Пропустить</button>
  <div class="progress">
    <div class="dot active"></div>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
</div>
</body>
</html>`

// ── State ─────────────────────────────────────────────────────────────────────

const activePageId = ref('p1')
const devicePreset = ref<DevicePreset>('Mobile 390')
const theme = ref<Theme>('light')
const isRendering = ref(false)
const activeInspectorTab = ref('interactions')
const activeComponentId = ref<string | null>(null)
const mockDataText = ref('{\n  "user": {\n    "name": "Алексей К.",\n    "role": "designer"\n  },\n  "product": {\n    "id": "abc123",\n    "name": "Nork"\n  }\n}')
const interactionLog = ref<LogEntry[]>([
  { id: 'l0', time: nowTime(), text: 'Component mounted: OnboardingScreen', type: 'load' },
])

function nowTime() {
  return new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const activePage = computed(() =>
  MOCK_PAGES.find(p => p.id === activePageId.value)
)

const iframeWidth = computed(() =>
  DEVICE_WIDTHS[devicePreset.value]
)

async function rerender() {
  isRendering.value = true
  await new Promise(r => setTimeout(r, 800))
  isRendering.value = false
  interactionLog.value.push({
    id: `l-${Date.now()}`,
    time: nowTime(),
    text: 'Component re-rendered',
    type: 'load',
  })
}

const logTypeColors: Record<string, string> = {
  click: 'text-blue-400',
  route: 'text-purple-400',
  input: 'text-yellow-400',
  load: 'text-emerald-400',
}

// Auto-append log entries
let logInterval: ReturnType<typeof setInterval>
let logIndex = 0

onMounted(() => {
  logInterval = setInterval(() => {
    const entry = LOG_MESSAGES[logIndex % LOG_MESSAGES.length]
    interactionLog.value.push({
      id: `l-${Date.now()}`,
      time: nowTime(),
      text: entry.text,
      type: entry.type,
    })
    logIndex++
    // Keep log trimmed
    if (interactionLog.value.length > 30) {
      interactionLog.value.shift()
    }
  }, 3000)
})

onUnmounted(() => {
  clearInterval(logInterval)
})

function toggleNode(id: string, nodes: ComponentNode[]) {
  for (const node of nodes) {
    if (node.id === id) {
      node.expanded = !node.expanded
      return true
    }
    if (node.children && toggleNode(id, node.children)) return true
  }
  return false
}

interface FlatNode {
  id: string
  name: string
  depth: number
  hasChildren: boolean
  expanded: boolean
}

function flattenTree(nodes: ComponentNode[], result: FlatNode[] = []): FlatNode[] {
  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      depth: node.depth,
      hasChildren: !!(node.children?.length),
      expanded: node.expanded,
    })
    if (node.expanded && node.children) {
      flattenTree(node.children, result)
    }
  }
  return result
}

const flatTree = computed(() => flattenTree(COMPONENT_TREE))
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <!-- Device presets -->
      <div class="flex items-center gap-0.5 rounded border border-border p-0.5">
        <button
          v-for="preset in DEVICE_PRESETS"
          :key="preset"
          class="rounded px-2 py-0.5 text-[11px] transition-colors"
          :class="devicePreset === preset
            ? 'bg-hover text-surface'
            : 'text-muted hover:text-surface'"
          @click="devicePreset = preset"
        >
          {{ preset }}
        </button>
      </div>

      <div class="h-4 w-px bg-border" />

      <!-- Theme toggle -->
      <div class="flex items-center gap-0.5 rounded border border-border p-0.5">
        <button
          class="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors"
          :class="theme === 'light' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
          @click="theme = 'light'"
        >
          <icon-lucide-sun class="size-3" />
          Light
        </button>
        <button
          class="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors"
          :class="theme === 'dark' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
          @click="theme = 'dark'; toast.info('Dark theme applied')"
        >
          <icon-lucide-moon class="size-3" />
          Dark
        </button>
      </div>

      <div class="h-4 w-px bg-border" />

      <Tip label="Перерендерить">
        <button
          class="flex size-7 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface transition-colors"
          :class="isRendering ? 'text-accent' : ''"
          @click="rerender"
        >
          <icon-lucide-refresh-cw class="size-4" :class="isRendering ? 'animate-spin' : ''" />
        </button>
      </Tip>

      <Tip label="Открыть в новой вкладке (недоступно)">
        <button class="flex size-7 cursor-not-allowed items-center justify-center rounded text-muted/40">
          <icon-lucide-external-link class="size-4" />
        </button>
      </Tip>
    </header>

    <SplitterGroup direction="horizontal" auto-save-id="preview-layout" class="flex-1 overflow-hidden">
      <!-- Left: Flow selector + mock data -->
      <SplitterPanel :default-size="18" :min-size="12" :max-size="28" class="flex flex-col overflow-hidden border-r border-border bg-panel">
        <header class="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted">Страницы</header>
        <div class="flex flex-col gap-0.5 px-2 pb-3">
          <button
            v-for="page in MOCK_PAGES"
            :key="page.id"
            class="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors"
            :class="activePageId === page.id
              ? 'bg-hover text-surface'
              : 'text-muted hover:bg-hover/70 hover:text-surface'"
            @click="activePageId = page.id"
          >
            <span class="truncate text-xs">{{ page.name }}</span>
            <span class="font-mono text-[10px] opacity-50">{{ page.url }}</span>
          </button>
        </div>

        <div class="h-px shrink-0 bg-border" />

        <header class="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted">Mock Data</header>
        <div class="min-h-0 flex-1 p-2">
          <textarea
            v-model="mockDataText"
            class="h-full w-full resize-none rounded border border-border bg-canvas p-2 font-mono text-[11px] text-surface/80 outline-none focus:border-accent/50"
          />
        </div>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Center: Browser viewport -->
      <SplitterPanel :default-size="60" :min-size="30" class="flex flex-col overflow-hidden bg-canvas">
        <!-- URL bar -->
        <div class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
          <div class="flex gap-1.5">
            <div class="size-2.5 rounded-full bg-border" />
            <div class="size-2.5 rounded-full bg-border" />
            <div class="size-2.5 rounded-full bg-border" />
          </div>
          <div class="flex flex-1 items-center gap-1.5 rounded border border-border bg-panel px-2.5 py-1">
            <icon-lucide-lock class="size-3 shrink-0 text-muted" />
            <span class="font-mono text-[11px] text-muted">beresta://preview{{ activePage?.url }}</span>
          </div>
        </div>

        <!-- Viewport area -->
        <div class="flex flex-1 items-start justify-center overflow-auto p-6">
          <div
            class="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-border/50 transition-all duration-300"
            :style="iframeWidth ? { width: iframeWidth + 'px', maxWidth: '100%' } : { width: '100%' }"
          >
            <!-- Rendering overlay -->
            <div
              v-if="isRendering"
              class="absolute inset-0 z-10 flex items-center justify-center bg-canvas/80 backdrop-blur-sm"
            >
              <div class="flex items-center gap-2 text-muted">
                <icon-lucide-loader-circle class="size-5 animate-spin" />
                <span class="text-sm">Re-rendering…</span>
              </div>
            </div>
            <iframe
              :srcdoc="MOCK_HTML"
              class="block w-full border-0"
              style="height: 560px;"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </SplitterPanel>

      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </SplitterResizeHandle>

      <!-- Right: Inspector -->
      <SplitterPanel :default-size="22" :min-size="16" :max-size="34" class="flex flex-col overflow-hidden border-l border-border bg-panel">
        <TabsRoot v-model="activeInspectorTab" class="flex h-full flex-col overflow-hidden">
          <TabsList class="flex shrink-0 border-b border-border">
            <TabsTrigger
              v-for="(label, value) in { interactions: 'Лог', components: 'Компоненты' }"
              :key="value"
              :value="value"
              class="flex-1 border-b-2 border-transparent px-2 py-2 text-[11px] transition-colors"
              :class="activeInspectorTab === value
                ? 'border-accent text-accent'
                : 'text-muted hover:text-surface'"
            >
              {{ label }}
            </TabsTrigger>
          </TabsList>

          <!-- Interactions log -->
          <TabsContent value="interactions" class="flex flex-1 flex-col overflow-hidden">
            <ScrollAreaRoot class="flex-1">
              <ScrollAreaViewport class="h-full">
                <div class="flex flex-col">
                  <div
                    v-for="entry in interactionLog"
                    :key="entry.id"
                    class="flex items-baseline gap-2 border-b border-border/30 px-2.5 py-1.5 hover:bg-hover/30 transition-colors"
                  >
                    <span class="shrink-0 font-mono text-[9px] text-muted/60">{{ entry.time }}</span>
                    <span
                      class="text-[11px] leading-relaxed"
                      :class="logTypeColors[entry.type]"
                    >{{ entry.text }}</span>
                  </div>
                </div>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
                <ScrollAreaThumb class="rounded-full bg-border" />
              </ScrollAreaScrollbar>
            </ScrollAreaRoot>
          </TabsContent>

          <!-- Component tree -->
          <TabsContent value="components" class="flex flex-1 flex-col overflow-hidden">
            <ScrollAreaRoot class="flex-1">
              <ScrollAreaViewport class="h-full py-1">
                <template v-for="node in flatTree" :key="node.id">
                  <button
                    class="flex w-full items-center gap-1 px-2 py-1 text-left text-[11px] transition-colors hover:bg-hover/50"
                    :class="activeComponentId === node.id ? 'bg-hover text-surface' : 'text-muted'"
                    :style="{ paddingLeft: (8 + node.depth * 12) + 'px' }"
                    @click="activeComponentId = node.id"
                  >
                    <icon-lucide-chevron-right
                      v-if="node.hasChildren"
                      class="size-3 shrink-0 transition-transform"
                      :class="node.expanded ? 'rotate-90' : ''"
                      @click.stop="toggleNode(node.id, COMPONENT_TREE)"
                    />
                    <span v-else class="size-3 shrink-0" />
                    <span class="truncate" :class="node.depth === 0 ? 'font-medium' : ''">{{ node.name }}</span>
                  </button>
                </template>
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

