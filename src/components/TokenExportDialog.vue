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

import { useI18n } from '@norka/vue'
import { exportTokens } from '@norka/core'

import { useEditorStore } from '@/stores/editor'
import { useDialogUI } from '@/components/ui/dialog'
import Tip from './ui/Tip.vue'

import type { TokenExportFormat } from '@norka/core'

const open = defineModel<boolean>('open', { default: false })
const cls = useDialogUI({ content: 'flex h-[75vh] w-[720px] max-w-[90vw] flex-col' })

const editor = useEditorStore()
const { panels, dialogs } = useI18n()

const activeFormat = ref<TokenExportFormat>('css')
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const FORMATS: Array<{
  value: TokenExportFormat
  labelKey: 'tokensFormatCSS' | 'tokensFormatTailwind' | 'tokensFormatJSON'
}> = [
  { value: 'css', labelKey: 'tokensFormatCSS' },
  { value: 'tailwind', labelKey: 'tokensFormatTailwind' },
  { value: 'tokens', labelKey: 'tokensFormatJSON' }
]

const fileExtensions: Record<TokenExportFormat, string> = {
  css: 'tokens.css',
  tailwind: 'tailwind.config.js',
  tokens: 'tokens.json'
}

const output = computed(() => {
  void editor.state.sceneVersion
  return exportTokens(editor.graph, activeFormat.value)
})

const isEmpty = computed(() => {
  // Check if there's anything to export: variables or local styles
  void editor.state.sceneVersion
  const hasVars = editor.graph.variables.size > 0
  const hasStyles = editor.graph.styles.size > 0
  return !hasVars && !hasStyles
})

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch (err) {
    console.warn('[TokenExport] Failed to copy to clipboard:', err)
  }
}

function downloadFile() {
  const blob = new Blob([output.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileExtensions[activeFormat.value]
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content">
        <TabsRoot v-model="activeFormat" class="flex flex-1 flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex shrink-0 items-center border-b border-border">
            <TabsList class="flex gap-0.5 px-3 py-1">
              <TabsTrigger
                v-for="fmt in FORMATS"
                :key="fmt.value"
                :value="fmt.value"
                class="cursor-pointer rounded border-none px-2.5 py-1 text-xs text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
              >
                {{ panels[fmt.labelKey] }}
              </TabsTrigger>
            </TabsList>

            <div class="ml-auto flex items-center gap-1.5 px-3">
              <DialogTitle class="sr-only">{{ panels.exportTokens }}</DialogTitle>

              <!-- Copy button -->
              <Tip :label="copied ? dialogs.copied : dialogs.copy">
                <button
                  class="flex cursor-pointer items-center gap-1 rounded border border-border bg-transparent px-2 py-0.5 text-xs text-muted hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="isEmpty"
                  @click="copyToClipboard()"
                >
                  <icon-lucide-check v-if="copied" class="size-3 text-success" />
                  <icon-lucide-copy v-else class="size-3" />
                  {{ copied ? panels.tokensCopied : dialogs.copy }}
                </button>
              </Tip>

              <!-- Download button -->
              <Tip :label="panels.tokensDownload">
                <button
                  class="flex cursor-pointer items-center gap-1 rounded border border-border bg-transparent px-2 py-0.5 text-xs text-muted hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="isEmpty"
                  @click="downloadFile()"
                >
                  <icon-lucide-download class="size-3" />
                  {{ panels.tokensDownload }}
                </button>
              </Tip>

              <DialogClose
                class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
              >
                <icon-lucide-x class="size-4" />
              </DialogClose>
            </div>
          </div>

          <!-- Content area (same for all tabs — the output changes) -->
          <TabsContent
            v-for="fmt in FORMATS"
            :key="fmt.value"
            :value="fmt.value"
            class="flex flex-1 flex-col overflow-hidden outline-none"
          >
            <!-- Empty state -->
            <div
              v-if="isEmpty"
              class="flex flex-1 flex-col items-center justify-center gap-2 text-center"
            >
              <icon-lucide-package-open class="size-8 text-muted" />
              <p class="text-xs text-muted">{{ panels.tokensEmpty }}</p>
              <p class="max-w-xs text-[10px] text-muted">{{ panels.tokensDescription }}</p>
            </div>

            <!-- Code output -->
            <div v-else class="relative flex-1 overflow-hidden">
              <pre
                class="scrollbar-thin h-full overflow-auto bg-input p-4 font-mono text-[11px] leading-relaxed text-surface"
                >{{ output }}</pre
              >

              <!-- Floating file name badge -->
              <div
                class="pointer-events-none absolute right-3 top-3 rounded border border-border bg-panel px-1.5 py-0.5 text-[10px] text-muted"
              >
                {{ fileExtensions[activeFormat] }}
              </div>
            </div>
          </TabsContent>
        </TabsRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
