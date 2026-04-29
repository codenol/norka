<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import { useDialogUI } from '@/components/ui/dialog'
import { TREE_JSON_CONTRACT_TEMPLATE } from '@/components/design/json-contract-template'
import { resolveIconPolicy } from '@/components/design/lucide-icon-contract'

interface ParseErrorDetails {
  message: string
  line: number | null
  column: number | null
}

interface TreeContractPayload {
  sidebar: unknown[]
  breadcrumbs: unknown[]
  main: unknown[]
  actions: unknown[]
  meta?: Record<string, unknown>
}

interface TreeNodeLike {
  id?: unknown
  props?: unknown
  children?: unknown
}

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  initialValue: string
}>()
const emit = defineEmits<{
  apply: [value: string]
}>()

const cls = useDialogUI({ content: 'flex h-[78vh] w-[900px] max-w-[92vw] flex-col' })
const draft = ref('')
const parseError = ref<ParseErrorDetails | null>(null)
const actionStatus = ref('')

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    draft.value = props.initialValue?.trim() ? props.initialValue : TREE_JSON_CONTRACT_TEMPLATE
    parseError.value = null
    actionStatus.value = ''
  },
  { immediate: true }
)

function parseSyntaxError(message: string): ParseErrorDetails {
  const lineMatch = message.match(/line\s+(\d+)/i)
  const columnMatch = message.match(/column\s+(\d+)/i)
  return {
    message,
    line: lineMatch ? Number(lineMatch[1]) : null,
    column: columnMatch ? Number(columnMatch[1]) : null
  }
}

function validateTreeJson(raw: string): { ok: true; payload: TreeContractPayload } | { ok: false; error: ParseErrorDetails } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON'
    return { ok: false, error: parseSyntaxError(message) }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: { message: 'Root must be a JSON object', line: null, column: null } }
  }

  const node = parsed as Record<string, unknown>
  const requiredArrayKeys: Array<keyof TreeContractPayload> = ['sidebar', 'breadcrumbs', 'main', 'actions']
  for (const key of requiredArrayKeys) {
    if (!Array.isArray(node[key])) {
      return { ok: false, error: { message: `"${key}" must be an array`, line: null, column: null } }
    }
  }

  if (node.meta !== undefined && (typeof node.meta !== 'object' || node.meta === null || Array.isArray(node.meta))) {
    return { ok: false, error: { message: '"meta" must be an object when provided', line: null, column: null } }
  }
  if (node.meta && typeof node.meta === 'object' && !Array.isArray(node.meta)) {
    const meta = node.meta as Record<string, unknown>
    if (meta.possibleIcons !== undefined && !Array.isArray(meta.possibleIcons)) {
      return { ok: false, error: { message: '"meta.possibleIcons" must be an array of icon names', line: null, column: null } }
    }
    if (meta.fallbackIcon !== undefined && (typeof meta.fallbackIcon !== 'string' || !meta.fallbackIcon.trim())) {
      return { ok: false, error: { message: '"meta.fallbackIcon" must be a non-empty string', line: null, column: null } }
    }
    if (meta.miniBar !== undefined) {
      if (!Array.isArray(meta.miniBar)) {
        return { ok: false, error: { message: '"meta.miniBar" must be an array', line: null, column: null } }
      }
      for (let i = 0; i < meta.miniBar.length; i++) {
        const item = meta.miniBar[i]
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return { ok: false, error: { message: `"meta.miniBar[${i}]" must be an object`, line: null, column: null } }
        }
        const state = (item as Record<string, unknown>).state
        if (
          state !== undefined &&
          state !== 'default' &&
          state !== 'hover' &&
          state !== 'active' &&
          state !== 'hover-active'
        ) {
          return {
            ok: false,
            error: { message: `"meta.miniBar[${i}].state" must be default|hover|active|hover-active`, line: null, column: null }
          }
        }
        const visible = (item as Record<string, unknown>).visible
        if (visible !== undefined && typeof visible !== 'boolean') {
          return { ok: false, error: { message: `"meta.miniBar[${i}].visible" must be boolean`, line: null, column: null } }
        }
      }
    }
  }

  const policy = resolveIconPolicy(node.meta)
  const queue: TreeNodeLike[] = [
    ...(node.sidebar as TreeNodeLike[]),
    ...(node.breadcrumbs as TreeNodeLike[]),
    ...(node.main as TreeNodeLike[]),
    ...(node.actions as TreeNodeLike[])
  ]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue
    const nodeId = typeof current.id === 'string' ? current.id : 'unknown-node'
    const props = current.props
    if (props !== undefined && (typeof props !== 'object' || props === null || Array.isArray(props))) {
      return { ok: false, error: { message: `"${nodeId}.props" must be an object`, line: null, column: null } }
    }
    if (props && typeof props === 'object' && !Array.isArray(props)) {
      const propBag = props as Record<string, unknown>
      for (const key of ['icon', 'iconLeft', 'iconRight'] as const) {
        if (!(key in propBag)) continue
        const value = propBag[key]
        if (typeof value !== 'string' || !value.trim()) {
          return { ok: false, error: { message: `"${nodeId}.${key}" must be a non-empty string`, line: null, column: null } }
        }
        const normalized = value.trim().toLowerCase()
        if (!policy.possibleIcons.includes(normalized)) {
          return {
            ok: false,
            error: {
              message: `"${nodeId}.${key}" uses unknown icon "${value}". Fallback: "${policy.fallbackIcon}"`,
              line: null,
              column: null
            }
          }
        }
      }
    }
    if (current.children !== undefined) {
      if (!Array.isArray(current.children)) {
        return { ok: false, error: { message: `"${nodeId}.children" must be an array`, line: null, column: null } }
      }
      queue.push(...(current.children as TreeNodeLike[]))
    }
  }

  const sidebarPanels = (node.sidebar as TreeNodeLike[]).filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      ((entry as Record<string, unknown>).component_id === 'DesignSystemSidebarPanel' ||
        (entry as Record<string, unknown>).component_id === 'sidebar_panel')
  )
  if (sidebarPanels.length > 1) {
    return {
      ok: false,
      error: {
        message: 'Sidebar allows only one DesignSystemSidebarPanel (single logo block).',
        line: null,
        column: null
      }
    }
  }
  for (const panel of sidebarPanels) {
    const panelProps =
      panel && typeof panel === 'object' && (panel as Record<string, unknown>).props
        ? ((panel as Record<string, unknown>).props as Record<string, unknown>)
        : {}
    if (!Array.isArray(panelProps.items) || panelProps.items.length === 0) {
      return {
        ok: false,
        error: {
          message: 'DesignSystemSidebarPanel must contain at least one menu item in props.items.',
          line: null,
          column: null
        }
      }
    }
  }

  return {
    ok: true,
    payload: {
      sidebar: node.sidebar as unknown[],
      breadcrumbs: node.breadcrumbs as unknown[],
      main: node.main as unknown[],
      actions: node.actions as unknown[],
      meta: node.meta as Record<string, unknown> | undefined
    }
  }
}

const highlightedLines = computed(() => {
  if (!parseError.value?.line) return []
  const lines = draft.value.split('\n')
  const target = parseError.value.line
  return lines
    .map((content, idx) => ({ line: idx + 1, content }))
    .filter(({ line }) => line >= target - 1 && line <= target + 1)
})

function applyJson() {
  const validation = validateTreeJson(draft.value)
  if (!validation.ok) {
    parseError.value = validation.error
    actionStatus.value = 'JSON contains validation errors'
    return
  }
  parseError.value = null
  actionStatus.value = 'Applied'
  emit('apply', JSON.stringify(validation.payload, null, 2))
  open.value = false
}

function formatJson() {
  const validation = validateTreeJson(draft.value)
  if (!validation.ok) {
    parseError.value = validation.error
    actionStatus.value = 'Cannot format invalid JSON'
    return
  }
  draft.value = JSON.stringify(validation.payload, null, 2)
  parseError.value = null
  actionStatus.value = 'Formatted'
}

async function copyContractTemplate() {
  actionStatus.value = ''
  try {
    await navigator.clipboard.writeText(TREE_JSON_CONTRACT_TEMPLATE)
    actionStatus.value = 'Contract copied'
  } catch {
    actionStatus.value = 'Clipboard access denied'
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content">
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <DialogTitle class="text-sm font-semibold">JSON Contract</DialogTitle>
          <DialogClose as-child>
            <button class="rounded p-1 text-muted transition-colors hover:bg-hover hover:text-surface">
              <icon-lucide-x class="size-4" />
            </button>
          </DialogClose>
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-2 p-4">
          <textarea
            v-model="draft"
            class="min-h-0 flex-1 rounded border bg-canvas p-3 font-mono text-xs leading-5 text-surface outline-none"
            :class="parseError ? 'border-danger/70 ring-1 ring-danger/40' : 'border-border focus:border-accent/60'"
            spellcheck="false"
            placeholder="Paste tree JSON here..."
          />

          <div v-if="parseError" class="rounded border border-danger/40 bg-danger/10 p-2 text-[11px] text-danger">
            <p>
              {{ parseError.message }}
              <template v-if="parseError.line">
                (line {{ parseError.line }}, col {{ parseError.column ?? '?' }})
              </template>
            </p>
            <pre
              v-if="highlightedLines.length > 0"
              class="mt-2 max-h-28 overflow-auto rounded bg-canvas/80 p-2 font-mono text-[10px] text-danger"
            ><span
              v-for="line in highlightedLines"
              :key="line.line"
              :class="line.line === parseError.line ? 'bg-danger/20' : ''"
            >{{ String(line.line).padStart(3, ' ') }} | {{ line.content }}
</span></pre>
          </div>

          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] text-muted">{{ actionStatus }}</span>
            <div class="flex items-center gap-2">
              <button
                class="rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
                @click="copyContractTemplate"
              >
                Скопировать контракт
              </button>
              <button
                class="rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
                @click="formatJson"
              >
                Форматировать
              </button>
              <button
                class="rounded border border-accent/50 bg-accent/15 px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/25"
                @click="applyJson"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

