<script setup lang="ts" generic="T extends string | number">
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemText,
  SelectLabel,
  SelectPortal,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'

import { computed } from 'vue'

import { useSelectUI } from '@/components/ui/select'

import type { PropType } from 'vue'

interface SelectOption<TValue extends string | number> {
  value: TValue
  label: string
}

interface SelectGroupDef<TValue extends string | number> {
  label?: string
  items: SelectOption<TValue>[]
}

interface GroupedSelectUi {
  trigger?: string
  content?: string
  item?: string
  label?: string
  separator?: string
}

const {
  groups,
  displayValue,
  ui = undefined,
  testId = undefined
} = defineProps({
  groups: { type: Array as PropType<SelectGroupDef<T>[]>, required: true as const },
  displayValue: { type: String, required: true as const },
  ui: { type: Object as PropType<GroupedSelectUi>, default: undefined },
  testId: { type: String, default: undefined }
})

const modelValue = defineModel<T>({ required: true })

const select = useSelectUI({
  trigger:
    ui?.trigger ??
    'w-full justify-between rounded border border-border bg-input px-2 py-1 text-[11px] text-surface',
  content: ui?.content ?? 'isolate z-[52]',
  contentVariants: { radius: 'lg', padding: 'md' },
  item: ui?.item ?? 'rounded px-2 py-1 text-[11px]'
})
const labelCls = computed(() => ui?.label ?? 'px-2 py-1 text-[10px] text-muted')
const separatorCls = computed(() => ui?.separator ?? 'mx-1 my-1 h-px bg-border')
</script>

<template>
  <SelectRoot v-model="modelValue">
    <SelectTrigger :data-test-id="testId" :class="select.trigger">
      <span class="flex-1 truncate text-left">{{ displayValue }}</span>
      <icon-lucide-chevron-down class="size-2.5 shrink-0 text-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" :side-offset="4" :class="select.content">
        <SelectViewport>
          <template v-for="(group, index) in groups" :key="index">
            <SelectGroup>
              <SelectLabel v-if="group.label" :class="labelCls">
                {{ group.label }}
              </SelectLabel>
              <SelectItem
                v-for="item in group.items"
                :key="String(item.value)"
                :value="item.value"
                :class="select.item"
              >
                <SelectItemText>{{ item.label }}</SelectItemText>
              </SelectItem>
            </SelectGroup>
            <SelectSeparator v-if="index < groups.length - 1" :class="separatorCls" />
          </template>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
