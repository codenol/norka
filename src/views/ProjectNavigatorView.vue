<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'

import Tip from '@/components/ui/Tip.vue'
import { useProjects, type Feature, type Product, type Screen } from '@/composables/use-projects'
import { useLibraries, LIBRARY_TYPE_COLORS } from '@/composables/use-libraries'
import {
  useWorkspaceFs,
  readProjectMd, writeProjectMd,
  readScreenMd, writeScreenMd,
} from '@/composables/use-workspace-fs'

const router = useRouter()
const {
  products, PIPELINE_STEPS, workspacePath,
  lastCompletedStep, stepProgress,
  addProduct, addScreen, addFeature,
  deleteProduct, deleteScreen, deleteFeature,
  connectLibrary, disconnectLibrary,
  setContext, loadFromDisk,
} = useProjects()
const { libraries } = useLibraries()
const { isDesktop, openWorkspaceDialog } = useWorkspaceFs()

const isOpeningWorkspace = ref(false)

async function handleOpenWorkspace() {
  isOpeningWorkspace.value = true
  try {
    const path = await openWorkspaceDialog()
    if (!path) return
    workspacePath.value = path
    await loadFromDisk(path)
  } finally {
    isOpeningWorkspace.value = false
  }
}

// ── Context editors ────────────────────────────────────────────────────────────

const editingProductId = ref<string | null>(null)
const productMdContent = ref('')
const productMdSaving  = ref(false)

async function openProductEditor(product: Product) {
  editingProductId.value = product.id
  productMdContent.value = workspacePath.value
    ? await readProjectMd(workspacePath.value, product.id)
    : ''
}

function closeProductEditor() {
  editingProductId.value = null
  productMdContent.value = ''
}

let productSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleProductSave(productId: string) {
  if (!workspacePath.value) return
  if (productSaveTimer) clearTimeout(productSaveTimer)
  productSaveTimer = setTimeout(async () => {
    const root = workspacePath.value
    if (!root) return
    productMdSaving.value = true
    await writeProjectMd(root, productId, productMdContent.value)
    productMdSaving.value = false
  }, 800)
}

const editingScreenKey = ref<string | null>(null)  // `${productId}:${screenId}`
const screenMdContent  = ref('')
const screenMdSaving   = ref(false)

async function openScreenEditor(product: Product, screen: Screen) {
  editingScreenKey.value = `${product.id}:${screen.id}`
  screenMdContent.value = workspacePath.value
    ? await readScreenMd(workspacePath.value, product.id, screen.id)
    : ''
}

function closeScreenEditor() {
  editingScreenKey.value = null
  screenMdContent.value = ''
}

let screenSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleScreenSave(productId: string, screenId: string) {
  if (!workspacePath.value) return
  if (screenSaveTimer) clearTimeout(screenSaveTimer)
  screenSaveTimer = setTimeout(async () => {
    const root = workspacePath.value
    if (!root) return
    screenMdSaving.value = true
    await writeScreenMd(root, productId, screenId, screenMdContent.value)
    screenMdSaving.value = false
  }, 800)
}

function workspaceName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

// ── Library connections ────────────────────────────────────────────────────────

const managingLibrariesForProduct = ref<string | null>(null)

function toggleLibraryConnection(productId: string, libraryId: string) {
  const product = products.value.find(p => p.id === productId)
  if (!product) return
  if (product.connectedLibraryIds.includes(libraryId)) {
    disconnectLibrary(productId, libraryId)
  } else {
    connectLibrary(productId, libraryId)
  }
}

function productConnectedLibraries(product: Product) {
  return libraries.value.filter(l => product.connectedLibraryIds.includes(l.id))
}

// ── UI state ───────────────────────────────────────────────────────────────────

const expandedProducts = ref<Set<string>>(new Set(products.value.map(p => p.id)))
const expandedScreens  = ref<Set<string>>(new Set(products.value.flatMap(p => p.screens.map(s => s.id))))

function toggleProduct(id: string) {
  if (expandedProducts.value.has(id)) expandedProducts.value.delete(id)
  else expandedProducts.value.add(id)
  expandedProducts.value = new Set(expandedProducts.value)
}
function toggleScreen(id: string) {
  if (expandedScreens.value.has(id)) expandedScreens.value.delete(id)
  else expandedScreens.value.add(id)
  expandedScreens.value = new Set(expandedScreens.value)
}

// ── Inline creation state ──────────────────────────────────────────────────────

const creatingProduct = ref(false)
const newProductTitle = ref('')

interface Creating { productId: string; screenId?: string }
const creatingIn = ref<Creating | null>(null)
const newTitle   = ref('')
const featureMetaDraft = ref({
  jiraIssueKey: '',
  jiraUrl: '',
  designerFullName: '',
  confluenceUrl: '',
})

function startCreateScreen(productId: string) {
  creatingIn.value = { productId }
  newTitle.value = ''
  expandedProducts.value.add(productId)
  expandedProducts.value = new Set(expandedProducts.value)
}
function startCreateFeature(productId: string, screenId: string) {
  creatingIn.value = { productId, screenId }
  newTitle.value = ''
  featureMetaDraft.value = {
    jiraIssueKey: '',
    jiraUrl: '',
    designerFullName: '',
    confluenceUrl: '',
  }
  expandedScreens.value.add(screenId)
  expandedScreens.value = new Set(expandedScreens.value)
}

function confirmCreate() {
  const title = newTitle.value.trim()
  if (!title || !creatingIn.value) { creatingIn.value = null; return }
  const { productId, screenId } = creatingIn.value
  if (screenId) {
    addFeature(productId, screenId, title, {
      jiraIssueKey: featureMetaDraft.value.jiraIssueKey.trim(),
      jiraUrl: featureMetaDraft.value.jiraUrl.trim(),
      designerFullName: featureMetaDraft.value.designerFullName.trim(),
      confluenceUrl: featureMetaDraft.value.confluenceUrl.trim(),
    })
  } else {
    const screen = addScreen(productId, title)
    if (screen) {
      expandedScreens.value.add(screen.id)
      expandedScreens.value = new Set(expandedScreens.value)
    }
  }
  creatingIn.value = null
  newTitle.value = ''
  featureMetaDraft.value = {
    jiraIssueKey: '',
    jiraUrl: '',
    designerFullName: '',
    confluenceUrl: '',
  }
}

function confirmNewProduct() {
  const title = newProductTitle.value.trim()
  if (!title) { creatingProduct.value = false; return }
  const product = addProduct(title)
  expandedProducts.value.add(product.id)
  expandedProducts.value = new Set(expandedProducts.value)
  newProductTitle.value = ''
  creatingProduct.value = false
}

// ── Navigation ─────────────────────────────────────────────────────────────────

function openFeature(product: Product, screen: Screen, feature: Feature) {
  setContext(product.id, screen.id, feature.id)
  // Navigate to the furthest completed step, or analytics if none
  const last = lastCompletedStep(feature)
  const step = last ?? 'analytics'
  router.push(`/workspace/${step}`)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function featureCount(product: Product): number {
  return product.screens.reduce((sum, s) => sum + s.features.length, 0)
}

function stepLabel(feature: Feature): string {
  const last = lastCompletedStep(feature)
  if (!last) return 'Не начата'
  return PIPELINE_STEPS.find(s => s.key === last)?.label ?? ''
}

function stepColor(feature: Feature): string {
  const last = lastCompletedStep(feature)
  if (!last) return 'text-muted'
  if (last === 'handoff') return 'text-emerald-400'
  return 'text-accent'
}
</script>

<template>
  <div class="flex h-screen w-screen select-text flex-col overflow-hidden bg-canvas">
    <!-- Top bar -->
    <header class="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
      <icon-lucide-layout-grid class="size-4 text-accent" />
      <span class="text-sm font-semibold text-surface">Проекты</span>

      <!-- Workspace path indicator -->
      <div v-if="workspacePath" class="flex items-center gap-1.5 rounded-lg bg-hover px-2.5 py-1 text-[11px] text-muted">
        <icon-lucide-folder-open class="size-3 text-accent" />
        <span class="max-w-48 truncate">{{ workspaceName(workspacePath) }}</span>
      </div>

      <div class="flex-1" />

      <!-- Open/change workspace (Tauri only) -->
      <Tip v-if="isDesktop" :label="workspacePath ? 'Сменить папку' : 'Открыть папку на диске'" side="bottom">
        <button
          class="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
          :disabled="isOpeningWorkspace"
          @click="handleOpenWorkspace"
        >
          <icon-lucide-folder-open class="size-3.5" />
          {{ workspacePath ? 'Сменить' : 'Открыть папку' }}
        </button>
      </Tip>

      <Tip label="Главная" side="bottom">
        <button
          class="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="$router.push('/home')"
        >
          <icon-lucide-home class="size-3.5" />
          Главная
        </button>
      </Tip>

      <Tip label="Библиотеки компонентов" side="bottom">
        <button
          class="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="$router.push('/libraries')"
        >
          <icon-lucide-library class="size-3.5" />
          Библиотеки
        </button>
      </Tip>
      <button
        class="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/80"
        @click="creatingProduct = true; newProductTitle = ''"
      >
        <icon-lucide-plus class="size-3.5" />
        Новый продукт
      </button>
    </header>

    <ScrollAreaRoot class="flex-1">
      <ScrollAreaViewport class="h-full">
        <div class="mx-auto max-w-3xl px-5 py-6">

          <!-- New product input -->
          <div
            v-if="creatingProduct"
            class="mb-4 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3"
          >
            <icon-lucide-folder class="size-4 shrink-0 text-accent" />
            <input
              v-model="newProductTitle"
              autofocus
              placeholder="Название продукта…"
              class="flex-1 bg-transparent text-sm text-surface outline-none placeholder:text-muted"
              @keydown.enter="confirmNewProduct"
              @keydown.escape="creatingProduct = false; newProductTitle = ''"
            />
            <button class="text-xs text-accent hover:underline" @click="confirmNewProduct">Создать</button>
            <button class="text-xs text-muted hover:text-surface" @click="creatingProduct = false">Отмена</button>
          </div>

          <!-- Products list -->
          <div class="flex flex-col gap-3">
            <div
              v-for="product in products"
              :key="product.id"
              class="overflow-hidden rounded-xl border border-border bg-panel"
            >
              <!-- Product header -->
              <div class="group flex items-center gap-2 px-4 py-3 transition-colors hover:bg-hover/40">
                <button class="flex flex-1 items-center gap-2 text-left" @click="toggleProduct(product.id)">
                  <icon-lucide-chevron-right
                    class="size-4 shrink-0 text-muted transition-transform duration-150"
                    :class="expandedProducts.has(product.id) ? 'rotate-90' : ''"
                  />
                  <icon-lucide-folder class="size-4 shrink-0 text-accent" />
                  <span class="flex-1 text-sm font-medium text-surface">{{ product.title }}</span>
                  <!-- Library badges -->
                  <div class="flex items-center gap-1">
                    <span
                      v-for="lib in productConnectedLibraries(product)"
                      :key="lib.id"
                      class="rounded px-1.5 py-0.5 text-[10px]"
                      :class="[LIBRARY_TYPE_COLORS[lib.type].bg, LIBRARY_TYPE_COLORS[lib.type].text]"
                    >{{ lib.name }}</span>
                  </div>
                  <span class="text-xs text-muted">{{ featureCount(product) }} фич</span>
                </button>
                <!-- Product actions (on hover) -->
                <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Tip label="Подключить библиотеки" side="top">
                    <button
                      class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
                      :class="managingLibrariesForProduct === product.id ? 'text-accent' : ''"
                      @click.stop="managingLibrariesForProduct = managingLibrariesForProduct === product.id ? null : product.id"
                    >
                      <icon-lucide-link class="size-3.5" />
                    </button>
                  </Tip>
                  <Tip label="Редактировать project.md" side="top">
                    <button
                      class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
                      :class="editingProductId === product.id ? 'text-accent' : ''"
                      @click.stop="editingProductId === product.id ? closeProductEditor() : openProductEditor(product)"
                    >
                      <icon-lucide-file-text class="size-3.5" />
                    </button>
                  </Tip>
                  <Tip label="Добавить экран" side="top">
                    <button
                      class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
                      @click.stop="startCreateScreen(product.id)"
                    >
                      <icon-lucide-plus class="size-3.5" />
                    </button>
                  </Tip>
                  <Tip label="Удалить продукт" side="top">
                    <button
                      class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-red-400"
                      @click.stop="deleteProduct(product.id)"
                    >
                      <icon-lucide-trash-2 class="size-3.5" />
                    </button>
                  </Tip>
                </div>
              </div>

              <!-- Library connections manager -->
              <div
                v-if="managingLibrariesForProduct === product.id"
                class="border-t border-border/60 bg-canvas/30 px-4 py-2.5"
              >
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-[11px] text-muted">Подключённые библиотеки</span>
                  <button class="text-[11px] text-muted hover:text-surface" @click="managingLibrariesForProduct = null">Готово</button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="lib in libraries"
                    :key="lib.id"
                    class="rounded-lg border px-2.5 py-1 text-xs transition-colors"
                    :class="product.connectedLibraryIds.includes(lib.id)
                      ? [LIBRARY_TYPE_COLORS[lib.type].bg, LIBRARY_TYPE_COLORS[lib.type].text, LIBRARY_TYPE_COLORS[lib.type].border]
                      : 'border-border text-muted hover:bg-hover hover:text-surface'"
                    @click="toggleLibraryConnection(product.id, lib.id)"
                  >
                    {{ lib.name }}
                  </button>
                  <span v-if="libraries.length === 0" class="text-[11px] text-muted/50">
                    Нет доступных библиотек
                  </span>
                </div>
              </div>

              <!-- project.md editor -->
              <div
                v-if="editingProductId === product.id"
                class="border-t border-border/60 bg-canvas/30 px-4 py-3"
              >
                <div class="mb-1.5 flex items-center justify-between">
                  <span class="text-[11px] text-muted">project.md</span>
                  <div class="flex items-center gap-2">
                    <span v-if="productMdSaving" class="text-[10px] text-muted">Сохранение…</span>
                    <span v-else-if="workspacePath" class="text-[10px] text-accent/70">Авто-сохранение</span>
                    <span v-else class="text-[10px] text-muted/50">Нет рабочей папки</span>
                    <button class="text-[11px] text-muted hover:text-surface" @click="closeProductEditor">Закрыть</button>
                  </div>
                </div>
                <textarea
                  v-model="productMdContent"
                  class="w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-xs text-surface outline-none placeholder:text-muted focus:border-accent/50"
                  rows="8"
                  placeholder="# Название продукта&#10;&#10;## Описание&#10;…"
                  @input="scheduleProductSave(product.id)"
                />
              </div>

              <!-- New screen input -->
              <div
                v-if="creatingIn?.productId === product.id && !creatingIn.screenId"
                class="flex items-center gap-2 border-t border-border/60 bg-canvas/40 px-4 py-2.5"
              >
                <div class="w-4 shrink-0" />
                <icon-lucide-monitor class="size-3.5 shrink-0 text-accent/70" />
                <input
                  v-model="newTitle"
                  autofocus
                  placeholder="Название экрана…"
                  class="flex-1 bg-transparent text-xs text-surface outline-none placeholder:text-muted"
                  @keydown.enter="confirmCreate"
                  @keydown.escape="creatingIn = null"
                />
                <button class="text-xs text-accent hover:underline" @click="confirmCreate">ОК</button>
              </div>

              <!-- Screens -->
              <template v-if="expandedProducts.has(product.id)">
                <div
                  v-for="screen in product.screens"
                  :key="screen.id"
                  class="border-t border-border/60"
                >
                  <!-- Screen header -->
                  <div class="group flex items-center gap-2 bg-canvas/40 px-4 py-2.5 transition-colors hover:bg-hover/30">
                    <button class="flex flex-1 items-center gap-2 text-left" @click="toggleScreen(screen.id)">
                      <div class="w-4 shrink-0" />
                      <icon-lucide-chevron-right
                        class="size-3.5 shrink-0 text-muted transition-transform duration-150"
                        :class="expandedScreens.has(screen.id) ? 'rotate-90' : ''"
                      />
                      <icon-lucide-monitor class="size-3.5 shrink-0 text-muted" />
                      <span class="flex-1 text-xs font-medium text-surface">{{ screen.title }}</span>
                      <span class="text-[11px] text-muted">{{ screen.features.length }} фич</span>
                    </button>
                    <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Tip label="Редактировать screen.md" side="top">
                        <button
                          class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
                          :class="editingScreenKey === `${product.id}:${screen.id}` ? 'text-accent' : ''"
                          @click.stop="editingScreenKey === `${product.id}:${screen.id}` ? closeScreenEditor() : openScreenEditor(product, screen)"
                        >
                          <icon-lucide-file-text class="size-3.5" />
                        </button>
                      </Tip>
                      <Tip label="Добавить фичу" side="top">
                        <button
                          class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
                          @click.stop="startCreateFeature(product.id, screen.id)"
                        >
                          <icon-lucide-plus class="size-3.5" />
                        </button>
                      </Tip>
                      <Tip label="Удалить экран" side="top">
                        <button
                          class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-red-400"
                          @click.stop="deleteScreen(product.id, screen.id)"
                        >
                          <icon-lucide-trash-2 class="size-3.5" />
                        </button>
                      </Tip>
                    </div>
                  </div>

                  <!-- screen.md editor -->
                  <div
                    v-if="editingScreenKey === `${product.id}:${screen.id}`"
                    class="border-t border-border/40 bg-canvas/20 px-4 py-3"
                  >
                    <div class="mb-1.5 flex items-center justify-between">
                      <span class="text-[11px] text-muted">screen.md</span>
                      <div class="flex items-center gap-2">
                        <span v-if="screenMdSaving" class="text-[10px] text-muted">Сохранение…</span>
                        <span v-else-if="workspacePath" class="text-[10px] text-accent/70">Авто-сохранение</span>
                        <span v-else class="text-[10px] text-muted/50">Нет рабочей папки</span>
                        <button class="text-[11px] text-muted hover:text-surface" @click="closeScreenEditor">Закрыть</button>
                      </div>
                    </div>
                    <textarea
                      v-model="screenMdContent"
                      class="w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-xs text-surface outline-none placeholder:text-muted focus:border-accent/50"
                      rows="6"
                      placeholder="# Экран: Название&#10;&#10;## Назначение&#10;…"
                      @input="scheduleScreenSave(product.id, screen.id)"
                    />
                  </div>

                  <!-- New feature input -->
                  <div
                    v-if="creatingIn?.productId === product.id && creatingIn.screenId === screen.id"
                    class="border-t border-border/40 px-4 py-2.5"
                  >
                    <div class="mb-2 flex items-center gap-2">
                      <div class="w-8 shrink-0" />
                      <icon-lucide-git-branch class="size-3.5 shrink-0 text-accent/70" />
                      <input
                        v-model="newTitle"
                        autofocus
                        placeholder="Название фичи…"
                        class="flex-1 bg-transparent text-xs text-surface outline-none placeholder:text-muted"
                        @keydown.enter="confirmCreate"
                        @keydown.escape="creatingIn = null"
                      />
                      <button class="text-xs text-accent hover:underline" @click="confirmCreate">ОК</button>
                    </div>
                    <div class="ml-10 grid grid-cols-2 gap-2">
                      <input
                        v-model="featureMetaDraft.jiraIssueKey"
                        placeholder="Jira key (например APP-123)"
                        class="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-surface outline-none"
                      />
                      <input
                        v-model="featureMetaDraft.designerFullName"
                        placeholder="ФИО дизайнера"
                        class="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-surface outline-none"
                      />
                      <input
                        v-model="featureMetaDraft.jiraUrl"
                        placeholder="Jira URL"
                        class="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-surface outline-none"
                      />
                      <input
                        v-model="featureMetaDraft.confluenceUrl"
                        placeholder="Confluence URL"
                        class="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-surface outline-none"
                      />
                    </div>
                  </div>

                  <!-- Features -->
                  <template v-if="expandedScreens.has(screen.id)">
                    <div
                      v-for="feature in screen.features"
                      :key="feature.id"
                      class="group flex cursor-pointer items-center gap-3 border-t border-border/40 px-4 py-2.5 transition-colors hover:bg-hover/40"
                      @click="openFeature(product, screen, feature)"
                    >
                      <div class="w-8 shrink-0" />
                      <icon-lucide-git-branch class="size-3.5 shrink-0 text-muted/60" />
                      <span class="flex-1 text-xs text-surface">{{ feature.title }}</span>
                      <span v-if="feature.jiraIssueKey" class="rounded bg-hover px-1.5 py-0.5 text-[10px] text-muted">
                        {{ feature.jiraIssueKey }}
                      </span>

                      <!-- Progress -->
                      <div class="flex items-center gap-2">
                        <!-- Step dots -->
                        <div class="flex items-center gap-0.5">
                          <div
                            v-for="step in PIPELINE_STEPS"
                            :key="step.key"
                            class="size-1.5 rounded-full transition-colors"
                            :class="feature.completedSteps.includes(step.key)
                              ? step.key === 'handoff' ? 'bg-emerald-400' : 'bg-accent'
                              : 'bg-border'"
                          />
                        </div>
                        <div class="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                          <div
                            class="h-full rounded-full transition-all duration-300"
                            :class="lastCompletedStep(feature) === 'handoff' ? 'bg-emerald-400' : 'bg-accent'"
                            :style="{ width: `${stepProgress(feature) * 100}%` }"
                          />
                        </div>
                        <span class="w-[72px] text-right text-[11px]" :class="stepColor(feature)">
                          {{ stepLabel(feature) }}
                        </span>
                        <icon-lucide-check
                          v-if="lastCompletedStep(feature) === 'handoff'"
                          class="size-3.5 shrink-0 text-emerald-400"
                        />
                        <Tip v-else label="Удалить фичу" side="left">
                          <button
                            class="size-5 flex items-center justify-center rounded text-muted opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                            @click.stop="deleteFeature(product.id, screen.id, feature.id)"
                          >
                            <icon-lucide-x class="size-3" />
                          </button>
                        </Tip>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </div>

            <!-- Empty state -->
            <div v-if="products.length === 0" class="flex flex-col items-center gap-4 py-16 text-center">
              <icon-lucide-layout-grid class="size-10 text-muted opacity-30" />
              <p class="text-sm text-muted">Нет продуктов. Создайте первый.</p>
            </div>
          </div>
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="vertical" class="w-1.5">
        <ScrollAreaThumb class="rounded-full bg-border" />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>
  </div>
</template>
