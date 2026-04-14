<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

import Tip from '@/components/ui/Tip.vue'
import IconBrainCircuit from '~icons/lucide/brain-circuit'
import IconPenTool from '~icons/lucide/pen-tool'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconSend from '~icons/lucide/send'
import IconLibrary from '~icons/lucide/library'
import IconSettings from '~icons/lucide/settings'

import { useAIChat } from '@/composables/use-chat'
import { useSettingsDialog } from '@/composables/use-settings-dialog'
import { useProjects } from '@/composables/use-projects'

const route   = useRoute()
const { isConfigured } = useAIChat()
const settings = useSettingsDialog()
const { currentFeature } = useProjects()

const ICONS = {
  analytics:  IconBrainCircuit,
  design:     IconPenTool,
  discussion: IconMessageCircle,
  handoff:    IconSend,
}

const pipeline = [
  { key: 'analytics'  as const, label: 'Аналитика',   href: '/workspace/analytics',  step: 1 },
  { key: 'design'     as const, label: 'Макеты',       href: '/workspace/design',     step: 2 },
  { key: 'discussion' as const, label: 'Обсуждение',   href: '/workspace/discussion', step: 3 },
  { key: 'handoff'    as const, label: 'Передача',     href: '/workspace/handoff',    step: 4 },
]

function isActive(href: string) {
  return route.path.startsWith(href)
}

function isDone(key: string): boolean {
  return currentFeature.value?.completedSteps.includes(key as any) ?? false
}
</script>

<template>
  <nav class="flex h-full w-12 shrink-0 flex-col items-center border-r border-border bg-canvas py-2">
    <!-- Pipeline steps -->
    <div class="flex flex-col items-center gap-0.5">
      <Tip
        v-for="step in pipeline"
        :key="step.href"
        :label="`${step.step}. ${step.label}`"
        side="right"
      >
        <RouterLink
          :to="step.href"
          class="relative flex size-9 flex-col items-center justify-center rounded-lg transition-colors"
          :class="isActive(step.href)
            ? 'bg-accent/15 text-accent'
            : 'text-muted hover:bg-hover hover:text-surface'"
        >
          <component :is="ICONS[step.key]" class="size-4" />

          <!-- Step number or done indicator -->
          <span
            v-if="!isDone(step.key)"
            class="absolute bottom-0.5 right-0.5 text-[8px] leading-none font-semibold opacity-40"
          >{{ step.step }}</span>
          <span
            v-else
            class="absolute bottom-0.5 right-0.5 flex size-2.5 items-center justify-center rounded-full"
            :class="step.key === 'handoff' ? 'bg-emerald-400/90' : 'bg-accent/80'"
          >
            <icon-lucide-check class="size-1.5 text-white" />
          </span>
        </RouterLink>
      </Tip>
    </div>

    <!-- Bottom: Library + Settings -->
    <div class="mt-auto flex flex-col items-center gap-0.5">
      <div class="mb-1.5 w-5 border-t border-border" />

      <Tip label="Библиотеки" side="right">
        <RouterLink
          to="/libraries"
          class="flex size-9 items-center justify-center rounded-lg transition-colors"
          :class="isActive('/libraries') || isActive('/library/')
            ? 'bg-accent/15 text-accent'
            : 'text-muted hover:bg-hover hover:text-surface'"
        >
          <IconLibrary class="size-4" />
        </RouterLink>
      </Tip>

      <Tip label="Настройки AI" side="right">
        <button
          class="relative flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="settings.show()"
        >
          <IconSettings class="size-4" />
          <span
            v-if="!isConfigured"
            class="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber-500"
          />
        </button>
      </Tip>
    </div>
  </nav>
</template>
