<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

import { useI18n } from '@beresta/vue'

import { useCodeConnectStore } from '@/stores/code-connect'
import { useLibraryStore } from '@/stores/library'
import { useDialogUI } from '@/components/ui/dialog'

import type { CodeConnectEntry, ComponentRule } from '@/stores/code-connect'

const open = defineModel<boolean>('open', { default: false })

const cls = useDialogUI({ content: 'flex h-[70vh] w-[680px] max-w-[90vw] flex-col' })
const { dialogs } = useI18n()
const codeConnect = useCodeConnectStore()
const libStore = useLibraryStore()

// ── Per-entry local editable state ───────────────────────────────────────────

interface EntryDraft {
  codeComponent: string
  importPath: string
  staticPropsRaw: string   // JSON string
  staticPropsError: boolean
  rulesOpen: boolean
  ruleUsage: string
  ruleConstraints: string  // newline-separated
  ruleExamples: string
  ruleAntiPatterns: string
}

const drafts = ref<Record<string, EntryDraft>>({})

function getDraft(entry: CodeConnectEntry): EntryDraft {
  if (!drafts.value[entry.componentNodeId]) {
    drafts.value[entry.componentNodeId] = {
      codeComponent: entry.codeComponent,
      importPath: entry.importPath,
      staticPropsRaw: Object.keys(entry.staticProps).length
        ? JSON.stringify(entry.staticProps, null, 2)
        : '',
      staticPropsError: false,
      rulesOpen: false,
      ruleUsage: entry.rules?.usage ?? '',
      ruleConstraints: entry.rules?.constraints.join('\n') ?? '',
      ruleExamples: entry.rules?.examples.join('\n') ?? '',
      ruleAntiPatterns: entry.rules?.antiPatterns.join('\n') ?? '',
    }
  }
  return drafts.value[entry.componentNodeId]
}

// ── Grouped entries per library ───────────────────────────────────────────────

const libraryGroups = computed(() => {
  const groups: Array<{ libraryId: string; name: string; entries: CodeConnectEntry[] }> = []
  const mapEntries = Object.values(codeConnect.map.value)

  for (const manifest of libStore.manifests.value) {
    const entries = mapEntries.filter((e) => e.libraryId === manifest.id)
    if (entries.length === 0) continue
    groups.push({ libraryId: manifest.id, name: manifest.name, entries })
  }

  return groups
})

// ── Save helpers ──────────────────────────────────────────────────────────────

function saveField(entry: CodeConnectEntry, field: 'codeComponent' | 'importPath'): void {
  const draft = getDraft(entry)
  codeConnect.upsertEntry({ ...entry, [field]: draft[field].trim() })
}

function saveProps(entry: CodeConnectEntry): void {
  const draft = getDraft(entry)
  const raw = draft.staticPropsRaw.trim()

  if (!raw) {
    draft.staticPropsError = false
    codeConnect.upsertEntry({ ...entry, staticProps: {} })
    return
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    draft.staticPropsError = false
    codeConnect.upsertEntry({ ...entry, staticProps: parsed })
  } catch (err) {
    console.warn('[CodeConnectDialog] Invalid JSON for staticProps:', err)
    draft.staticPropsError = true
  }
}

function saveRules(entry: CodeConnectEntry): void {
  const draft = getDraft(entry)

  const splitLines = (s: string): string[] =>
    s.split('\n').map((l) => l.trim()).filter(Boolean)

  const rule: ComponentRule = {
    usage: draft.ruleUsage.trim(),
    constraints: splitLines(draft.ruleConstraints),
    examples: splitLines(draft.ruleExamples),
    antiPatterns: splitLines(draft.ruleAntiPatterns),
    updatedAt: new Date().toISOString(),
    updatedBy: 'designer',
  }

  codeConnect.upsertEntry({ ...entry, rules: rule })
}

// ── Duplicate codeComponent detection ────────────────────────────────────────

const duplicateNames = computed(() => {
  const counts = new Map<string, number>()
  for (const entry of Object.values(codeConnect.map.value)) {
    if (!entry.codeComponent) continue
    counts.set(entry.codeComponent, (counts.get(entry.codeComponent) ?? 0) + 1)
  }
  const dupes = new Set<string>()
  for (const [name, count] of counts) {
    if (count > 1) dupes.add(name)
  }
  return dupes
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content">

        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <DialogTitle class="text-sm font-semibold text-surface">
            {{ dialogs.codeConnect }}
          </DialogTitle>
          <DialogClose
            class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
          >
            <icon-lucide-x class="size-4" />
          </DialogClose>
        </div>

        <!-- Body -->
        <div class="min-h-0 flex-1 overflow-y-auto">

          <!-- Empty state -->
          <div
            v-if="libraryGroups.length === 0"
            class="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center"
          >
            <icon-lucide-link-2 class="size-8 text-muted" />
            <p class="max-w-[280px] text-xs text-muted">{{ dialogs.codeConnectEmpty }}</p>
          </div>

          <!-- Groups -->
          <template v-else>
            <div
              v-for="group in libraryGroups"
              :key="group.libraryId"
              class="border-b border-border last:border-0"
            >
              <!-- Library header -->
              <div class="sticky top-0 z-10 bg-panel px-4 py-2">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {{ group.name }}
                </p>
              </div>

              <!-- Column headers -->
              <div class="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 border-b border-border/50 px-4 py-1.5">
                <span class="text-[10px] font-medium text-muted">{{ dialogs.codeConnectDesignName }}</span>
                <span class="text-[10px] font-medium text-muted">{{ dialogs.codeConnectCodeComponent }}</span>
                <span class="text-[10px] font-medium text-muted">{{ dialogs.codeConnectImportPath }}</span>
                <span class="text-[10px] font-medium text-muted">{{ dialogs.codeConnectProps }}</span>
              </div>

              <!-- Entries -->
              <div
                v-for="entry in group.entries"
                :key="entry.componentNodeId"
                class="border-b border-border/30 last:border-0"
              >
                <!-- Main row -->
                <div class="grid grid-cols-[1fr_1fr_1fr_80px] items-center gap-2 px-4 py-2 hover:bg-hover/30">
                  <!-- Design name (read-only) -->
                  <div class="flex min-w-0 items-center gap-1">
                    <span class="truncate text-xs text-surface">{{ entry.designName }}</span>
                  </div>

                  <!-- Code component -->
                  <div class="flex min-w-0 items-center gap-1">
                    <input
                      :value="getDraft(entry).codeComponent"
                      type="text"
                      placeholder="Button"
                      class="w-full min-w-0 rounded border border-border bg-panel px-1.5 py-1 text-xs text-surface placeholder-muted outline-none focus:border-accent"
                      :class="{ 'border-warning': duplicateNames.has(getDraft(entry).codeComponent) && getDraft(entry).codeComponent }"
                      @input="getDraft(entry).codeComponent = ($event.target as HTMLInputElement).value"
                      @blur="saveField(entry, 'codeComponent')"
                    />
                    <span
                      v-if="duplicateNames.has(getDraft(entry).codeComponent) && getDraft(entry).codeComponent"
                      class="shrink-0 text-[10px] text-warning"
                      title="Duplicate component name"
                    >⚠</span>
                  </div>

                  <!-- Import path -->
                  <input
                    :value="getDraft(entry).importPath"
                    type="text"
                    placeholder="@ds/ui"
                    class="min-w-0 rounded border border-border bg-panel px-1.5 py-1 text-xs text-surface placeholder-muted outline-none focus:border-accent"
                    @input="getDraft(entry).importPath = ($event.target as HTMLInputElement).value"
                    @blur="saveField(entry, 'importPath')"
                  />

                  <!-- Props -->
                  <div class="flex items-center gap-1">
                    <input
                      :value="getDraft(entry).staticPropsRaw"
                      type="text"
                      placeholder="{}"
                      class="min-w-0 flex-1 rounded border bg-panel px-1.5 py-1 font-mono text-[10px] text-surface placeholder-muted outline-none focus:border-accent"
                      :class="getDraft(entry).staticPropsError ? 'border-error' : 'border-border'"
                      @input="getDraft(entry).staticPropsRaw = ($event.target as HTMLInputElement).value"
                      @blur="saveProps(entry)"
                    />
                  </div>
                </div>

                <!-- Rules expander -->
                <div class="px-4 pb-1">
                  <button
                    class="flex items-center gap-1 text-[10px] text-muted hover:text-surface"
                    @click="getDraft(entry).rulesOpen = !getDraft(entry).rulesOpen"
                  >
                    <icon-lucide-chevron-right
                      class="size-3 transition-transform"
                      :class="{ 'rotate-90': getDraft(entry).rulesOpen }"
                    />
                    <span v-if="entry.rules">
                      {{ dialogs.codeConnectRules }}
                      <span class="ml-1 text-muted">
                        ({{ dialogs.rulesUpdatedBy }}: {{ entry.rules.updatedBy }})
                      </span>
                    </span>
                    <span v-else class="flex items-center gap-1">
                      <span class="text-warning">⚠</span>
                      {{ dialogs.noRules }}
                    </span>
                  </button>

                  <!-- Rules panel -->
                  <div
                    v-if="getDraft(entry).rulesOpen"
                    class="mt-2 flex flex-col gap-2 rounded border border-border bg-hover/20 p-3"
                  >
                    <div class="flex flex-col gap-1">
                      <label class="text-[10px] font-medium text-muted">{{ dialogs.ruleUsage }}</label>
                      <textarea
                        v-model="getDraft(entry).ruleUsage"
                        rows="2"
                        :placeholder="dialogs.ruleUsagePlaceholder"
                        class="resize-none rounded border border-border bg-panel px-2 py-1.5 text-xs text-surface placeholder-muted outline-none focus:border-accent"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-[10px] font-medium text-muted">{{ dialogs.ruleConstraints }}</label>
                      <textarea
                        v-model="getDraft(entry).ruleConstraints"
                        rows="2"
                        :placeholder="dialogs.ruleConstraintsPlaceholder"
                        class="resize-none rounded border border-border bg-panel px-2 py-1.5 text-xs text-surface placeholder-muted outline-none focus:border-accent"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-[10px] font-medium text-muted">{{ dialogs.ruleExamples }}</label>
                      <textarea
                        v-model="getDraft(entry).ruleExamples"
                        rows="2"
                        :placeholder="dialogs.ruleExamplesPlaceholder"
                        class="resize-none rounded border border-border bg-panel px-2 py-1.5 text-xs text-surface placeholder-muted outline-none focus:border-accent"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-[10px] font-medium text-muted">{{ dialogs.ruleAntiPatterns }}</label>
                      <textarea
                        v-model="getDraft(entry).ruleAntiPatterns"
                        rows="2"
                        :placeholder="dialogs.ruleAntiPatternsPlaceholder"
                        class="resize-none rounded border border-border bg-panel px-2 py-1.5 text-xs text-surface placeholder-muted outline-none focus:border-accent"
                      />
                    </div>
                    <button
                      class="self-start rounded bg-surface px-3 py-1.5 text-xs font-medium text-panel hover:opacity-80"
                      @click="saveRules(entry)"
                    >
                      {{ dialogs.saveRules }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
