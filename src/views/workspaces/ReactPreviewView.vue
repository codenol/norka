<script setup lang="ts">
import { usePrimeTheme } from '@/composables/use-prime-theme'
import { provideProtoStore } from '@/composables/use-proto-store'
import ProtoComponentPanel from '@/components/proto/ProtoComponentPanel.vue'
import ProtoCanvas from '@/components/proto/ProtoCanvas.vue'
import ProtoPropsPanel from '@/components/proto/ProtoPropsPanel.vue'

const store = provideProtoStore()
const { nodes, mode } = store
const { theme, themes } = usePrimeTheme()
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <!-- Header toolbar -->
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <!-- Mode switcher -->
      <div class="flex items-center gap-0.5 rounded border border-border p-0.5">
        <button
          class="flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] transition-colors"
          :class="mode === 'editor' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
          @click="mode = 'editor'"
        >
          <icon-lucide-pencil class="size-3" />
          Редактор
        </button>
        <button
          class="flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] transition-colors"
          :class="mode === 'view' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
          @click="mode = 'view'"
        >
          <icon-lucide-play class="size-3" />
          Прототип
        </button>
      </div>

      <!-- Node count -->
      <span class="text-[11px] text-muted">
        {{ nodes.length }} {{ nodes.length === 1 ? 'компонент' : nodes.length < 5 ? 'компонента' : 'компонентов' }}
      </span>

      <select
        v-model="theme"
        class="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-muted outline-none focus:border-accent/60"
      >
        <option
          v-for="item in themes"
          :key="item.id"
          :value="item.id"
        >
          {{ item.label }}
        </option>
      </select>

      <div class="flex-1" />

      <!-- Clear button -->
      <button
        v-if="nodes.length > 0"
        class="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
        @click="store.clearAll()"
      >
        <icon-lucide-trash-2 class="size-3" />
        Очистить
      </button>

      <span class="text-[11px] text-muted">React + PrimeReact</span>
    </header>

    <!-- Main layout -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left: component panel (editor only) -->
      <ProtoComponentPanel v-if="mode === 'editor'" />

      <!-- Center: canvas -->
      <div class="flex flex-1 flex-col overflow-hidden bg-canvas">
        <div class="h-full overflow-auto">
          <ProtoCanvas />
        </div>
      </div>

      <!-- Right: props panel (editor only) -->
      <ProtoPropsPanel v-if="mode === 'editor'" />
    </div>
  </div>
</template>
