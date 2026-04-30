<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import Tip from '@/components/ui/Tip.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import IconBrainCircuit from '~icons/lucide/brain-circuit'
import IconHome from '~icons/lucide/home'
import IconLayoutGrid from '~icons/lucide/layout-grid'
import IconPenTool from '~icons/lucide/pen-tool'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconSend from '~icons/lucide/send'
import IconLibrary from '~icons/lucide/library'
import IconMoon from '~icons/lucide/moon'
import IconSettings from '~icons/lucide/settings'
import IconSun from '~icons/lucide/sun'

import { useAIChat } from '@/composables/use-chat'
import { usePrimeTheme } from '@/composables/use-prime-theme'
import { useSettingsDialog } from '@/composables/use-settings-dialog'
import { useProjects } from '@/composables/use-projects'
import { initialsForName, roleTitle, useWorkspaceUser } from '@/composables/use-workspace-user'
import { buildWorkspacePath } from '@/utils/workspace-route'

import type { PipelineStep } from '@/composables/use-projects'

const route = useRoute()
const router = useRouter()
const { isConfigured } = useAIChat()
const { theme } = usePrimeTheme()
const settings = useSettingsDialog()
const { currentFeature } = useProjects()
const { currentUser, users, logout, selectUser } = useWorkspaceUser()
const menuCls = useMenuUI({ content: 'min-w-52' })
const itemCls = menuItem({ justify: 'start', class: 'justify-between gap-3' })
const userMenuOpen = ref(false)

const ICONS = {
  analytics: IconBrainCircuit,
  design: IconPenTool,
  discussion: IconMessageCircle,
  handoff: IconSend
}

const routeContext = computed(() => {
  const productId = route.params.productId
  const screenId = route.params.screenId
  const featureId = route.params.featureId
  if (
    typeof productId !== 'string' ||
    typeof screenId !== 'string' ||
    typeof featureId !== 'string'
  ) {
    return null
  }
  return { productId, screenId, featureId }
})

const pipeline = [
  { key: 'analytics' as const, label: 'Аналитика', step: 1 },
  { key: 'design' as const, label: 'Прототип', step: 2 },
  { key: 'discussion' as const, label: 'Обсуждение', step: 3 },
  { key: 'handoff' as const, label: 'Передача', step: 4 }
]

const primaryNav = [
  { to: '/home', label: 'Главная', icon: IconHome, active: ['/home'] },
  { to: '/projects', label: 'Проекты', icon: IconLayoutGrid, active: ['/projects', '/workspace'] },
  { to: '/libraries', label: 'Библиотеки', icon: IconLibrary, active: ['/libraries', '/library'] }
]

function stepHref(key: PipelineStep): string {
  return routeContext.value ? buildWorkspacePath(key, routeContext.value) : '/projects'
}

function isPipelineActive(key: PipelineStep) {
  return route.path.endsWith(`/${key}`)
}

function isRouteActive(prefix: string) {
  return route.path.startsWith(prefix)
}

function isDone(key: PipelineStep): boolean {
  return currentFeature.value?.completedSteps.includes(key) ?? false
}

function toggleTheme() {
  theme.value = theme.value === 'lara-light-blue' ? 'lara-dark-blue' : 'lara-light-blue'
}

async function handleLogout() {
  logout()
  userMenuOpen.value = false
  await router.replace('/login')
}
</script>

<template>
  <nav
    class="flex h-full w-12 shrink-0 flex-col items-center border-r border-border bg-canvas py-2"
  >
    <!-- Pipeline steps -->
    <div class="flex flex-col items-center gap-0.5">
      <Tip v-for="item in primaryNav" :key="item.to" :label="item.label" side="right">
        <RouterLink
          :to="item.to"
          class="relative flex size-9 items-center justify-center rounded-lg transition-colors"
          :class="
            item.active.some((prefix) => isRouteActive(prefix))
              ? 'bg-accent/15 text-accent'
              : 'text-muted hover:bg-hover hover:text-surface'
          "
        >
          <component :is="item.icon" class="size-4" />
        </RouterLink>
      </Tip>

      <div v-if="routeContext" class="my-1.5 h-px w-5 bg-border" />

      <template v-if="routeContext">
        <Tip
          v-for="step in pipeline"
          :key="step.key"
          :label="`${step.step}. ${step.label}`"
          side="right"
        >
          <RouterLink
            :to="stepHref(step.key)"
            class="relative flex size-9 flex-col items-center justify-center rounded-lg transition-colors"
            :class="
              isPipelineActive(step.key)
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:bg-hover hover:text-surface'
            "
          >
            <component :is="ICONS[step.key]" class="size-4" />

            <!-- Step number or done indicator -->
            <span
              v-if="!isDone(step.key)"
              class="absolute bottom-0.5 right-0.5 text-[8px] leading-none font-semibold opacity-40"
              >{{ step.step }}</span
            >
            <span
              v-else
              class="absolute bottom-0.5 right-0.5 flex size-2.5 items-center justify-center rounded-full"
              :class="step.key === 'handoff' ? 'bg-emerald-400/90' : 'bg-accent/80'"
            >
              <icon-lucide-check class="size-1.5 text-white" />
            </span>
          </RouterLink>
        </Tip>
      </template>
    </div>

    <!-- Bottom: Settings + User -->
    <div class="mt-auto flex flex-col items-center gap-0.5">
      <div class="mb-1.5 w-5 border-t border-border" />

      <Tip label="Сменить тему" side="right">
        <button
          class="relative flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="toggleTheme"
        >
          <IconSun v-if="theme === 'lara-light-blue'" class="size-4" />
          <IconMoon v-else class="size-4" />
        </button>
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

      <DropdownMenuRoot v-model:open="userMenuOpen">
        <DropdownMenuTrigger as-child>
          <button
            class="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-surface"
            :title="`${currentUser.name} · ${roleTitle(currentUser.role)}`"
          >
            <span
              class="flex size-6 items-center justify-center rounded-full border border-accent/30 bg-accent/15 text-[10px] font-semibold text-accent"
            >
              {{ initialsForName(currentUser.name) }}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent :side-offset="8" side="right" align="end" :class="menuCls.content">
            <div class="border-b border-border px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted">
              Пользователь Норки
            </div>
            <DropdownMenuItem
              v-for="user in users"
              :key="user.id"
              :class="itemCls"
              @select="selectUser(user.id)"
            >
              <span class="flex min-w-0 items-center gap-2">
                <span
                  class="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent"
                >
                  {{ initialsForName(user.name) }}
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-xs">{{ user.name }}</span>
                  <span class="block text-[10px] text-muted">{{ roleTitle(user.role) }}</span>
                </span>
              </span>
              <icon-lucide-check v-if="currentUser.id === user.id" class="size-3 text-accent" />
            </DropdownMenuItem>
            <div class="my-1 h-px bg-border" />
            <DropdownMenuItem :class="itemCls" @select="handleLogout">
              <span class="text-xs text-red-400">Выйти</span>
              <icon-lucide-log-out class="size-3 text-red-400" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </nav>
</template>
