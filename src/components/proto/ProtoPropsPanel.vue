<script setup lang="ts">
import { computed } from 'vue'
import { getPrimePreviewDef } from '@/composables/use-primereact-preview'
import { useProtoStore } from '@/composables/use-proto-store'

const store = useProtoStore()

// Expose stable refs for template auto-unwrap
const selectedNode = store.selectedNode

type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'json'

function getFieldType(value: unknown): FieldType {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  return 'json'
}

interface PropField {
  key: string
  type: FieldType
  value: unknown
  options?: string[]
  defaultValue?: unknown
}

const fields = computed<PropField[]>(() => {
  const node = selectedNode.value
  if (!node) return []
  const def = getPrimePreviewDef(node.componentName)
  return Object.entries(node.props).map(([key, value]) => ({
    key,
    type: def?.propSchema?.[key]?.type ?? getFieldType(value),
    value,
    options: def?.propSchema?.[key]?.options,
    defaultValue: def?.previewProps?.[key],
  }))
})

function onStringChange(key: string, e: Event) {
  const val = (e.target as HTMLInputElement).value
  const node = selectedNode.value
  if (node) store.setProp(node.id, key, val)
}

function onNumberChange(key: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  const node = selectedNode.value
  if (!isNaN(val) && node) store.setProp(node.id, key, val)
}

function onBooleanChange(key: string, value: boolean) {
  const node = selectedNode.value
  if (node) store.setProp(node.id, key, value)
}

function onJsonChange(key: string, e: Event) {
  const node = selectedNode.value
  if (!node) return
  const text = (e.target as HTMLTextAreaElement).value
  try {
    const parsed = JSON.parse(text)
    store.setProp(node.id, key, parsed)
  } catch {
    // Keep input editable until JSON is valid.
  }
}

function resetField(field: PropField) {
  const node = selectedNode.value
  if (!node) return
  if (field.defaultValue === undefined) return
  store.setProp(node.id, field.key, field.defaultValue)
}
</script>

<template>
  <div class="flex h-full w-56 shrink-0 flex-col border-l border-border/60 bg-panel/80" style="contain: paint layout style">
    <div class="flex shrink-0 items-center border-b border-border/60 px-3 py-2">
      <span class="text-[11px] font-medium text-surface">Свойства</span>
    </div>

    <div v-if="!selectedNode" class="flex flex-1 items-center justify-center">
      <p class="px-4 text-center text-[11px] text-muted">Выберите компонент на канвасе</p>
    </div>

    <template v-else>
      <!-- Component name badge -->
      <div class="shrink-0 border-b border-border/60 px-3 py-2">
        <div class="flex items-center gap-1.5">
          <div class="flex size-5 items-center justify-center rounded bg-accent/20">
            <icon-lucide-component class="size-3 text-accent" />
          </div>
          <span class="text-[12px] font-medium text-surface">{{ selectedNode.componentName }}</span>
        </div>
      </div>

      <!-- Props form -->
      <div class="flex-1 overflow-y-auto px-3 py-2">
        <div v-if="fields.length === 0" class="py-4 text-center">
          <p class="text-[11px] text-muted">Нет редактируемых свойств</p>
        </div>
        <div class="flex flex-col gap-3">
          <div v-for="field in fields" :key="field.key" class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <label class="text-[10px] uppercase tracking-wider text-muted">{{ field.key }}</label>
              <button
                v-if="field.defaultValue !== undefined"
                class="text-[10px] text-muted hover:text-surface"
                @click="resetField(field)"
              >
                reset
              </button>
            </div>

            <!-- Boolean toggle -->
            <div v-if="field.type === 'boolean'" class="flex items-center">
              <button
                class="relative inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none"
                :class="field.value ? 'bg-accent' : 'bg-border'"
                role="switch"
                :aria-checked="field.value as boolean"
                @click="onBooleanChange(field.key, !(field.value as boolean))"
              >
                <span
                  class="pointer-events-none inline-block size-3 rounded-full bg-white shadow-lg transition-transform"
                  :class="field.value ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
              <span class="ml-2 text-[11px] text-muted">{{ field.value ? 'true' : 'false' }}</span>
            </div>

            <!-- Number input -->
            <input
              v-else-if="field.type === 'number'"
              type="number"
              :value="field.value as number"
              class="w-full rounded border border-border bg-canvas px-2 py-1 text-[11px] text-surface outline-none focus:border-accent/60"
              @change="onNumberChange(field.key, $event)"
            />

            <!-- String input -->
            <input
              v-else-if="field.type === 'string'"
              type="text"
              :value="field.value as string"
              class="w-full rounded border border-border bg-canvas px-2 py-1 text-[11px] text-surface outline-none focus:border-accent/60"
              @input="onStringChange(field.key, $event)"
            />

            <select
              v-else-if="field.type === 'enum'"
              :value="field.value as string"
              class="w-full rounded border border-border bg-canvas px-2 py-1 text-[11px] text-surface outline-none focus:border-accent/60"
              @change="onStringChange(field.key, $event)"
            >
              <option
                v-for="opt in field.options ?? []"
                :key="opt"
                :value="opt"
              >
                {{ opt }}
              </option>
            </select>

            <!-- Other (JSON display) -->
            <textarea
              v-else
              :value="JSON.stringify(field.value, null, 2)"
              class="min-h-20 w-full rounded border border-border/60 bg-canvas px-2 py-1 font-mono text-[10px] text-muted outline-none focus:border-accent/60"
              @change="onJsonChange(field.key, $event)"
            />
          </div>
        </div>
      </div>

      <!-- Delete node button -->
      <div class="shrink-0 border-t border-border/60 px-3 py-2">
        <button
          class="flex w-full items-center justify-center gap-1.5 rounded border border-red-500/30 py-1 text-[11px] text-red-400 transition-colors hover:bg-red-500/10"
          @click="store.removeNode(selectedNode.id)"
        >
          <icon-lucide-trash-2 class="size-3" />
          Удалить компонент
        </button>
      </div>
    </template>
  </div>
</template>
