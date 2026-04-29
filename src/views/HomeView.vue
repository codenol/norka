<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { useLibraries, LIBRARY_TYPE_COLORS, LIBRARY_TYPE_LABELS } from '@/composables/use-libraries'
import { useProjects, type Product } from '@/composables/use-projects'
import { useSettingsDialog } from '@/composables/use-settings-dialog'
import { useWorkspaceFs } from '@/composables/use-workspace-fs'

const { libraries } = useLibraries()
const { products } = useProjects()
const settings = useSettingsDialog()
const { workspacePath } = useWorkspaceFs()

function workspaceName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

function connectedProjectCount(libId: string): number {
  return products.value.filter((p) => p.connectedLibraryIds.includes(libId)).length
}

function productLibraries(product: Product) {
  return libraries.value.filter((l) => product.connectedLibraryIds.includes(l.id))
}

function featureCount(product: Product): number {
  return product.screens.reduce((s, sc) => s + sc.features.length, 0)
}

function pluralProjects(n: number): string {
  if (n === 1) return '1 проект'
  if (n >= 2 && n <= 4) return `${n} проекта`
  return `${n} проектов`
}
</script>

<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden bg-canvas select-text">
    <!-- Header -->
    <header class="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
      <icon-lucide-pencil class="size-4 text-accent" />
      <span class="text-sm font-semibold text-surface">Norka</span>

      <div
        v-if="workspacePath"
        class="flex items-center gap-1.5 rounded-lg bg-hover px-2.5 py-1 text-[11px] text-muted"
      >
        <icon-lucide-folder-open class="size-3 text-accent" />
        <span class="max-w-48 truncate">{{ workspaceName(workspacePath) }}</span>
      </div>

      <div class="flex-1" />

      <button
        class="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="settings.show()"
      >
        <icon-lucide-settings class="size-4" />
      </button>
    </header>

    <!-- Hub cards -->
    <div class="flex flex-1 items-center justify-center overflow-auto px-6 py-8">
      <div class="grid w-full max-w-4xl grid-cols-2 gap-5">
        <!-- Libraries card -->
        <RouterLink
          to="/libraries"
          class="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-border bg-panel p-6 transition-colors hover:border-border/80 hover:bg-hover/20 no-underline"
        >
          <!-- Card header -->
          <div class="flex items-center gap-2.5">
            <div class="flex size-9 items-center justify-center rounded-xl bg-accent/10">
              <icon-lucide-library class="size-4.5 text-accent" />
            </div>
            <div>
              <p class="text-sm font-semibold text-surface">Библиотеки</p>
              <p class="text-[11px] text-muted">{{ libraries.length }} библиотек</p>
            </div>
          </div>

          <!-- Library list -->
          <div class="flex flex-col gap-1.5">
            <div v-for="lib in libraries.slice(0, 4)" :key="lib.id" class="flex items-center gap-2">
              <div
                class="size-1.5 shrink-0 rounded-full"
                :class="LIBRARY_TYPE_COLORS[lib.type].text.replace('text-', 'bg-')"
              />
              <span class="flex-1 truncate text-xs text-surface">{{ lib.name }}</span>
              <span
                class="rounded px-1.5 py-0.5 text-[10px]"
                :class="[LIBRARY_TYPE_COLORS[lib.type].bg, LIBRARY_TYPE_COLORS[lib.type].text]"
                >{{ LIBRARY_TYPE_LABELS[lib.type] }}</span
              >
              <span class="text-[11px] text-muted">{{
                pluralProjects(connectedProjectCount(lib.id))
              }}</span>
            </div>
            <div v-if="libraries.length === 0" class="text-xs text-muted/50">Нет библиотек</div>
          </div>

          <!-- Footer -->
          <div
            class="mt-auto flex items-center gap-1 text-xs text-accent transition-colors group-hover:text-accent/80"
          >
            <span>Открыть библиотеки</span>
            <icon-lucide-arrow-right class="size-3.5" />
          </div>
        </RouterLink>

        <!-- Projects card -->
        <RouterLink
          to="/projects"
          class="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-border bg-panel p-6 transition-colors hover:border-border/80 hover:bg-hover/20 no-underline"
        >
          <!-- Card header -->
          <div class="flex items-center gap-2.5">
            <div class="flex size-9 items-center justify-center rounded-xl bg-accent/10">
              <icon-lucide-layout-grid class="size-4.5 text-accent" />
            </div>
            <div>
              <p class="text-sm font-semibold text-surface">Проекты</p>
              <p class="text-[11px] text-muted">
                {{ products.length }} продукт{{
                  products.length === 1 ? '' : products.length < 5 ? 'а' : 'ов'
                }}
              </p>
            </div>
          </div>

          <!-- Product list -->
          <div class="flex flex-col gap-2">
            <div
              v-for="product in products.slice(0, 4)"
              :key="product.id"
              class="flex flex-col gap-1"
            >
              <div class="flex items-center gap-2">
                <icon-lucide-folder class="size-3.5 shrink-0 text-accent/60" />
                <span class="flex-1 truncate text-xs font-medium text-surface">{{
                  product.title
                }}</span>
                <span class="text-[11px] text-muted">{{ featureCount(product) }} фич</span>
              </div>
              <!-- Library badges -->
              <div v-if="productLibraries(product).length" class="flex items-center gap-1 pl-5">
                <span
                  v-for="lib in productLibraries(product).slice(0, 3)"
                  :key="lib.id"
                  class="rounded px-1.5 py-0.5 text-[10px]"
                  :class="[LIBRARY_TYPE_COLORS[lib.type].bg, LIBRARY_TYPE_COLORS[lib.type].text]"
                  >{{ lib.name }}</span
                >
                <span v-if="productLibraries(product).length > 3" class="text-[10px] text-muted">
                  +{{ productLibraries(product).length - 3 }}
                </span>
              </div>
            </div>
            <div v-if="products.length === 0" class="text-xs text-muted/50">Нет продуктов</div>
          </div>

          <!-- Footer -->
          <div
            class="mt-auto flex items-center gap-1 text-xs text-accent transition-colors group-hover:text-accent/80"
          >
            <span>Открыть проекты</span>
            <icon-lucide-arrow-right class="size-3.5" />
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
