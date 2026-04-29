<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'

import Tip from '@/components/ui/Tip.vue'
import {
  useLibraries,
  LIBRARY_TYPE_COLORS,
  LIBRARY_TYPE_LABELS,
  type LibraryType
} from '@/composables/use-libraries'
import { useProjects, type Product } from '@/composables/use-projects'
import { useWorkspaceFs } from '@/composables/use-workspace-fs'

const router = useRouter()
const { libraries, addLibrary, deleteLibrary } = useLibraries()
const { products } = useProjects()
const { workspacePath } = useWorkspaceFs()

function workspaceName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

function connectedProjects(libId: string): Product[] {
  return products.value.filter((p) => p.connectedLibraryIds.includes(libId))
}

// ── Inline creation ────────────────────────────────────────────────────────────

const creatingLibrary = ref(false)
const newLibName = ref('')
const newLibType = ref<LibraryType>('extension')

const LIB_TYPES: { type: LibraryType; label: string }[] = [
  { type: 'core', label: 'Core' },
  { type: 'extension', label: 'Extension' },
  { type: 'white-label', label: 'White-label' },
  { type: 'project', label: 'Project' }
]

function startCreate() {
  creatingLibrary.value = true
  newLibName.value = ''
  newLibType.value = 'extension'
}

function confirmCreate() {
  const name = newLibName.value.trim()
  if (!name) {
    creatingLibrary.value = false
    return
  }
  addLibrary(name, newLibType.value)
  newLibName.value = ''
  creatingLibrary.value = false
}
</script>

<template>
  <div class="flex h-screen w-screen select-text flex-col overflow-hidden bg-canvas">
    <!-- Header -->
    <header class="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
      <Tip label="Главная" side="bottom">
        <button
          class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="router.push('/home')"
        >
          <icon-lucide-arrow-left class="size-3.5" />
        </button>
      </Tip>

      <div class="h-4 w-px bg-border" />

      <icon-lucide-library class="size-4 text-accent" />
      <span class="text-sm font-semibold text-surface">Библиотеки</span>

      <div
        v-if="workspacePath"
        class="flex items-center gap-1.5 rounded-lg bg-hover px-2.5 py-1 text-[11px] text-muted"
      >
        <icon-lucide-folder-open class="size-3 text-accent" />
        <span class="max-w-48 truncate">{{ workspaceName(workspacePath) }}</span>
      </div>

      <div class="flex-1" />

      <button
        class="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/80"
        @click="startCreate"
      >
        <icon-lucide-plus class="size-3.5" />
        Новая библиотека
      </button>
    </header>

    <ScrollAreaRoot class="flex-1">
      <ScrollAreaViewport class="h-full">
        <div class="mx-auto max-w-3xl px-5 py-6">
          <!-- Inline creation -->
          <div
            v-if="creatingLibrary"
            class="mb-5 overflow-hidden rounded-xl border border-accent/40 bg-accent/5"
          >
            <div class="flex items-center gap-2 px-4 py-3">
              <icon-lucide-library class="size-4 shrink-0 text-accent" />
              <input
                v-model="newLibName"
                autofocus
                placeholder="Название библиотеки…"
                class="flex-1 bg-transparent text-sm text-surface outline-none placeholder:text-muted"
                @keydown.enter="confirmCreate"
                @keydown.escape="creatingLibrary = false"
              />
              <button class="text-xs text-accent hover:underline" @click="confirmCreate">
                Создать
              </button>
              <button
                class="text-xs text-muted hover:text-surface"
                @click="creatingLibrary = false"
              >
                Отмена
              </button>
            </div>
            <!-- Type selector -->
            <div class="flex items-center gap-1.5 border-t border-accent/20 px-4 py-2">
              <span class="text-[11px] text-muted mr-1">Тип:</span>
              <button
                v-for="t in LIB_TYPES"
                :key="t.type"
                class="rounded-lg border px-2.5 py-1 text-[11px] transition-colors"
                :class="
                  newLibType === t.type
                    ? [
                        LIBRARY_TYPE_COLORS[t.type].bg,
                        LIBRARY_TYPE_COLORS[t.type].text,
                        LIBRARY_TYPE_COLORS[t.type].border
                      ]
                    : 'border-border text-muted hover:bg-hover hover:text-surface'
                "
                @click="newLibType = t.type"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <!-- Libraries list -->
          <div class="flex flex-col gap-3">
            <div
              v-for="lib in libraries"
              :key="lib.id"
              class="overflow-hidden rounded-xl border border-border bg-panel"
            >
              <!-- Library header row -->
              <div
                class="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-hover/40"
              >
                <!-- Type dot -->
                <div
                  class="size-2.5 shrink-0 rounded-full"
                  :class="LIBRARY_TYPE_COLORS[lib.type].text.replace('text-', 'bg-')"
                />

                <!-- Name + meta -->
                <div class="flex flex-1 flex-col gap-0.5 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium text-surface">{{ lib.name }}</span>
                    <span
                      class="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                      :class="[
                        LIBRARY_TYPE_COLORS[lib.type].bg,
                        LIBRARY_TYPE_COLORS[lib.type].text
                      ]"
                      >{{ LIBRARY_TYPE_LABELS[lib.type] }}</span
                    >
                  </div>
                  <span class="truncate text-xs text-muted">{{ lib.description || '—' }}</span>
                </div>

                <!-- Stats -->
                <span class="shrink-0 text-xs text-muted"
                  >{{ lib.componentCount }} компонентов</span
                >
                <span class="shrink-0 text-xs text-muted"
                  >{{ connectedProjects(lib.id).length }} проектов</span
                >

                <!-- Hover actions -->
                <div
                  class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Tip label="Открыть библиотеку" side="top">
                    <button
                      class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
                      @click="router.push(`/library/${lib.id}`)"
                    >
                      <icon-lucide-arrow-right class="size-3.5" />
                    </button>
                  </Tip>
                  <Tip label="Удалить библиотеку" side="top">
                    <button
                      class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-red-400"
                      @click="deleteLibrary(lib.id)"
                    >
                      <icon-lucide-trash-2 class="size-3.5" />
                    </button>
                  </Tip>
                </div>
              </div>

              <!-- Connected projects sub-row -->
              <div class="border-t border-border/60 bg-canvas/30 px-4 py-2.5">
                <span class="text-[11px] text-muted">Подключено к:</span>
                <div
                  v-if="connectedProjects(lib.id).length === 0"
                  class="mt-1 text-[11px] text-muted/40"
                >
                  Не подключено ни к одному проекту
                </div>
                <div v-else class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <div
                    v-for="p in connectedProjects(lib.id)"
                    :key="p.id"
                    class="flex cursor-pointer items-center gap-1.5 text-xs text-surface hover:text-accent transition-colors"
                    @click="router.push('/projects')"
                  >
                    <icon-lucide-folder class="size-3 text-accent/50" />
                    {{ p.title }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div
              v-if="libraries.length === 0"
              class="flex flex-col items-center gap-4 py-16 text-center"
            >
              <icon-lucide-library class="size-10 text-muted opacity-30" />
              <p class="text-sm text-muted">Нет библиотек. Создайте первую.</p>
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
