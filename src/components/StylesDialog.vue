<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'

import { useI18n, useSceneComputed } from '@norka/vue'

import { colorToCSS } from '@norka/core'

import { useEditorStore } from '@/stores/editor'
import { useDialogUI } from '@/components/ui/dialog'
import Tip from './ui/Tip.vue'

import type { NamedStyle, FillStyle, TextStyle } from '@norka/core'

type StyleTab = 'FILL' | 'TEXT' | 'EFFECT'

const open = defineModel<boolean>('open', { default: false })
const cls = useDialogUI({ content: 'flex h-[70vh] w-[640px] max-w-[90vw] flex-col' })

const editor = useEditorStore()
const { dialogs, panels } = useI18n()

const activeTab = ref<StyleTab>('FILL')
const editingId = ref<string | null>(null)
const editingName = ref('')
const searchTerm = ref('')

const allStyles = useSceneComputed(() => {
  void editor.state.sceneVersion
  return editor.getStyles()
})

const filteredStyles = computed(() => {
  const q = searchTerm.value.toLowerCase()
  return allStyles.value
    .filter((s) => s.type === activeTab.value)
    .filter((s) => !q || s.name.toLowerCase().includes(q))
})

function startEdit(style: NamedStyle) {
  editingId.value = style.id
  editingName.value = style.name
}

function commitEdit(id: string) {
  if (editingName.value.trim()) {
    editor.updateStyleName(id, editingName.value.trim())
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function addStyle() {
  if (activeTab.value === 'FILL') {
    const s = editor.addFillStyle('Fill style')
    startEdit(s)
  } else if (activeTab.value === 'TEXT') {
    const s = editor.addTextStyle('Text style')
    startEdit(s)
  } else {
    const s = editor.addEffectStyle('Effect style')
    startEdit(s)
  }
}

function getFillColor(style: NamedStyle): string {
  const fill = style as FillStyle
  if (!fill.fills?.length) return 'transparent'
  const f = fill.fills[0]
  if (!f?.color) return 'transparent'
  return colorToCSS(f.color)
}

function getTextPreview(style: NamedStyle): string {
  const s = style as TextStyle
  return `${s.fontFamily} · ${s.fontSize}px · ${s.fontWeight}`
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content">
        <TabsRoot v-model="activeTab" class="flex flex-1 flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex shrink-0 items-center border-b border-border">
            <TabsList class="flex gap-0.5 px-3 py-1">
              <TabsTrigger
                value="FILL"
                class="cursor-pointer rounded border-none px-2.5 py-1 text-xs text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
              >
                {{ panels.fill }}
              </TabsTrigger>
              <TabsTrigger
                value="TEXT"
                class="cursor-pointer rounded border-none px-2.5 py-1 text-xs text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
              >
                {{ panels.typography }}
              </TabsTrigger>
              <TabsTrigger
                value="EFFECT"
                class="cursor-pointer rounded border-none px-2.5 py-1 text-xs text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
              >
                {{ panels.effects }}
              </TabsTrigger>
            </TabsList>

            <div class="ml-auto flex items-center gap-1.5 px-3">
              <div class="flex items-center gap-1 rounded border border-border px-2 py-0.5">
                <icon-lucide-search class="size-3 text-muted" />
                <input
                  v-model="searchTerm"
                  class="w-24 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
                  :placeholder="dialogs.search"
                />
              </div>
              <DialogTitle class="sr-only">{{ dialogs.namedStyles }}</DialogTitle>
              <DialogClose
                class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
              >
                <icon-lucide-x class="size-4" />
              </DialogClose>
            </div>
          </div>

          <!-- Tab contents -->
          <TabsContent
            v-for="tab in ['FILL', 'TEXT', 'EFFECT'] as const"
            :key="tab"
            :value="tab"
            class="flex flex-1 flex-col overflow-hidden outline-none"
          >
            <div v-if="filteredStyles.length === 0" class="flex flex-1 items-center justify-center">
              <p class="text-xs text-muted">{{ dialogs.noStylesYet }}</p>
            </div>
            <div v-else class="flex-1 overflow-y-auto">
              <div
                v-for="style in filteredStyles"
                :key="style.id"
                class="group flex items-center gap-2 border-b border-border/30 px-4 py-2 hover:bg-hover/50"
              >
                <!-- Color swatch for fill styles -->
                <div
                  v-if="style.type === 'FILL'"
                  class="size-5 shrink-0 rounded border border-border"
                  :style="{ background: getFillColor(style) }"
                />
                <!-- Type icon for text styles -->
                <icon-lucide-type
                  v-else-if="style.type === 'TEXT'"
                  class="size-4 shrink-0 text-muted"
                />
                <!-- Effect icon -->
                <icon-lucide-sparkles v-else class="size-4 shrink-0 text-muted" />

                <!-- Name (editable) -->
                <input
                  v-if="editingId === style.id"
                  :ref="(el) => (el as HTMLInputElement)?.focus()"
                  class="flex-1 rounded border border-accent bg-input px-1.5 py-0.5 text-xs text-surface outline-none"
                  :value="editingName"
                  @input="editingName = ($event.target as HTMLInputElement).value"
                  @blur="commitEdit(style.id)"
                  @keydown.enter="commitEdit(style.id)"
                  @keydown.escape="cancelEdit()"
                />
                <div v-else class="flex flex-1 flex-col gap-0.5" @dblclick="startEdit(style)">
                  <span class="text-xs text-surface">{{ style.name }}</span>
                  <span v-if="style.type === 'TEXT'" class="text-[10px] text-muted">
                    {{ getTextPreview(style) }}
                  </span>
                </div>

                <!-- Delete button -->
                <Tip :label="dialogs.deleteStyle">
                  <button
                    class="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-transparent hover:bg-hover hover:text-muted group-hover:text-muted"
                    @click="editor.removeStyle(style.id)"
                  >
                    <icon-lucide-trash-2 class="size-3.5" />
                  </button>
                </Tip>
              </div>
            </div>

            <!-- Add button -->
            <button
              class="flex w-full shrink-0 cursor-pointer items-center gap-1.5 border-t border-border bg-transparent px-4 py-2 text-xs text-muted hover:bg-hover hover:text-surface"
              @click="addStyle()"
            >
              <icon-lucide-plus class="size-3.5" />
              {{ dialogs.createStyle }}
            </button>
          </TabsContent>
        </TabsRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
