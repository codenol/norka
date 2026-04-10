<script setup lang="ts">
import Prism from 'prismjs'
import 'prismjs/components/prism-jsx'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import { selectionToJSX, selectionToCode } from '@beresta/core'
import { useI18n, useSceneComputed } from '@beresta/vue'

import { useEditorStore } from '@/stores/editor'
import { useCodeConnectStore } from '@/stores/code-connect'
import CodeConnectDialog from '@/components/CodeConnectDialog.vue'

import type { JSXFormat, CodeFramework } from '@beresta/core'

const store = useEditorStore()
const codeConnect = useCodeConnectStore()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })
const { dialogs } = useI18n()

// ── Format / Framework toggles ────────────────────────────────────────────────

const jsxFormat = ref<JSXFormat>('beresta')
const codeFramework = ref<CodeFramework>('react-tsx')
const useCodeConnect = ref(true)  // use Code Connect map when available
const codeConnectOpen = ref(false)

function toggleFormat() {
  jsxFormat.value = jsxFormat.value === 'beresta' ? 'tailwind' : 'beresta'
}

const frameworkLabel = computed(() => {
  if (codeFramework.value === 'react-tsx') return dialogs.value.frameworkReact
  if (codeFramework.value === 'vue-sfc') return dialogs.value.frameworkVue
  return dialogs.value.frameworkHtml
})

function cycleFramework() {
  const order: CodeFramework[] = ['react-tsx', 'vue-sfc', 'html-tailwind']
  const idx = order.indexOf(codeFramework.value)
  codeFramework.value = order[(idx + 1) % order.length]
}

// ── Code generation ───────────────────────────────────────────────────────────

const hasCodeConnect = computed(() => Object.keys(codeConnect.map.value).length > 0)

// Raw JSX (always available as fallback)
const jsxCode = useSceneComputed(() => {
  void store.state.sceneVersion
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) return ''
  return selectionToJSX(ids, store.graph, jsxFormat.value)
})

// Rich code with Code Connect resolved components
const generatedCode = useSceneComputed(() => {
  void store.state.sceneVersion
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) return null
  if (!hasCodeConnect.value || !useCodeConnect.value) return null
  return selectionToCode(ids, store.graph, codeConnect.map.value, codeFramework.value)
})

// What we display in the code viewer
const displayCode = computed(() => generatedCode.value?.code ?? jsxCode.value)

const unmappedCount = computed(() => generatedCode.value?.unresolvedInstanceIds.length ?? 0)

const highlightedLines = computed(() => {
  if (!displayCode.value) return []
  const grammar = Prism.languages.jsx ?? Prism.languages.javascript
  return displayCode.value.split('\n').map((line) => Prism.highlight(line, grammar, 'jsx'))
})

// ── Copy actions ──────────────────────────────────────────────────────────────

const copiedFull = ref(false)

function copyRaw() {
  copy(jsxCode.value)
}

function copyFull() {
  const code = generatedCode.value?.code ?? jsxCode.value
  navigator.clipboard.writeText(code).then(() => {
    copiedFull.value = true
    setTimeout(() => { copiedFull.value = false }, 2000)
  }).catch((err) => {
    console.warn('[CodePanel] Clipboard write failed:', err)
  })
}
</script>

<template>
  <div
    v-if="!displayCode"
    data-test-id="code-panel-empty"
    class="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
  >
    <span class="text-xs text-muted">{{ dialogs.selectLayerForJSX }}</span>
    <button
      :title="dialogs.openCodeConnect"
      class="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted hover:bg-hover hover:text-surface"
      @click="codeConnectOpen = true"
    >
      <icon-lucide-link-2 class="size-3" />
      {{ dialogs.openCodeConnect }}
    </button>
    <CodeConnectDialog v-model:open="codeConnectOpen" />
  </div>

  <div v-else data-test-id="code-panel" class="flex min-h-0 flex-1 flex-col">
    <!-- Header -->
    <div
      data-test-id="code-panel-header"
      class="flex shrink-0 flex-wrap items-center justify-between gap-1 border-b border-border px-3 py-1.5"
    >
      <!-- Left: format/framework toggles -->
      <div class="flex items-center gap-1">
        <!-- Raw JSX format (only shown when code connect not active) -->
        <button
          v-if="!generatedCode"
          data-test-id="code-panel-format-toggle"
          class="rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="toggleFormat"
        >
          {{ jsxFormat === 'beresta' ? 'Береста' : 'Tailwind' }}
        </button>

        <!-- Framework selector (when Code Connect is active) -->
        <button
          v-if="hasCodeConnect"
          class="rounded px-1.5 py-0.5 text-[11px]"
          :class="useCodeConnect ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-hover hover:text-surface'"
          @click="cycleFramework"
        >
          {{ frameworkLabel }}
        </button>

        <!-- Toggle Code Connect on/off -->
        <button
          v-if="hasCodeConnect"
          class="rounded px-1 py-0.5 text-[10px]"
          :class="useCodeConnect ? 'text-accent' : 'text-muted'"
          :title="dialogs.openCodeConnect"
          @click="useCodeConnect = !useCodeConnect"
        >
          <icon-lucide-link-2 class="size-3" />
        </button>
      </div>

      <!-- Right: Code Connect button + copy -->
      <div class="flex items-center gap-0.5">
        <button
          :title="dialogs.openCodeConnect"
          class="flex size-5 items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
          @click="codeConnectOpen = true"
        >
          <icon-lucide-link-2 class="size-3.5" />
        </button>

        <!-- Copy with imports (when generatedCode available) -->
        <button
          v-if="generatedCode"
          data-test-id="code-panel-copy-full"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="copyFull"
        >
          <icon-lucide-check v-if="copiedFull" class="size-3 text-green-400" />
          <icon-lucide-copy v-else class="size-3" />
          {{ copiedFull ? dialogs.copied : dialogs.copyWithImports }}
        </button>

        <!-- Standard copy -->
        <button
          data-test-id="code-panel-copy"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="copyRaw"
        >
          <icon-lucide-check v-if="copied" class="size-3 text-green-400" />
          <icon-lucide-copy v-else class="size-3" />
          {{ copied ? dialogs.copied : dialogs.copy }}
        </button>
      </div>
    </div>

    <!-- Unmapped warning -->
    <div
      v-if="unmappedCount > 0"
      class="flex shrink-0 cursor-pointer items-center gap-1.5 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-[11px] text-warning hover:bg-warning/15"
      @click="codeConnectOpen = true"
    >
      <icon-lucide-alert-triangle class="size-3 shrink-0" />
      <span>{{ dialogs.unmappedInstances({ count: String(unmappedCount) }) }} →</span>
    </div>

    <!-- Code viewer -->
    <ScrollAreaRoot class="min-h-0 flex-1">
      <ScrollAreaViewport class="size-full">
        <div class="p-3">
          <div v-for="(html, i) in highlightedLines" :key="i" class="flex text-xs leading-5">
            <span
              class="mr-3 shrink-0 text-right text-muted/40 select-none"
              style="min-width: 1.5em"
              >{{ i + 1 }}</span
            >
            <pre
              class="m-0 min-w-0 flex-1 break-words whitespace-pre-wrap"
            ><code v-html="html" /></pre>
          </div>
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
        <ScrollAreaThumb class="relative flex-1 rounded-full bg-white/10" />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>
  </div>

  <CodeConnectDialog v-model:open="codeConnectOpen" />
</template>

<style scoped>
.token.tag {
  color: #7dd3fc;
}
.token.attr-name {
  color: #c4b5fd;
}
.token.attr-value,
.token.string {
  color: #86efac;
}
.token.number {
  color: #fca5a5;
}
.token.punctuation {
  color: #888;
}
.token.boolean {
  color: #fca5a5;
}
.token.keyword {
  color: #c4b5fd;
}
</style>
