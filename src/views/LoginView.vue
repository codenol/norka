<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { initialsForName, roleTitle, useWorkspaceUser } from '@/composables/use-workspace-user'

const route = useRoute()
const router = useRouter()
const { currentUser, login, users } = useWorkspaceUser()

const selectedUserId = ref(currentUser.value.id)

const selectedUser = computed(
  () => users.find((user) => user.id === selectedUserId.value) ?? currentUser.value
)

async function submitLogin() {
  login(selectedUserId.value)
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
  await router.replace(redirect)
}
</script>

<template>
  <div class="flex h-screen w-screen items-center justify-center bg-canvas px-4">
    <div class="w-full max-w-3xl rounded-2xl border border-border bg-panel shadow-2xl">
      <div class="border-b border-border px-6 py-5">
        <p class="text-[11px] uppercase tracking-[0.2em] text-muted">Norka</p>
        <h1 class="mt-2 text-2xl font-semibold text-surface">Вход в Норку</h1>
        <p class="mt-1 text-sm text-muted">
          Демо-вход по захардкоженным пользователям. Выберите логин и роль для работы.
        </p>
      </div>

      <div class="grid gap-3 p-4 md:grid-cols-2">
        <button
          v-for="user in users"
          :key="user.id"
          class="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
          :class="
            selectedUserId === user.id
              ? 'border-accent bg-accent/10'
              : 'border-border bg-canvas hover:bg-hover'
          "
          @click="selectedUserId = user.id"
          @dblclick="submitLogin"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
          >
            {{ initialsForName(user.name) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-surface">{{ user.name }}</span>
            <span class="block truncate font-mono text-[11px] text-muted">@{{ user.login }}</span>
            <span class="mt-1 block text-xs text-muted">{{ roleTitle(user.role) }}</span>
          </span>
          <icon-lucide-check
            v-if="selectedUserId === user.id"
            class="size-4 shrink-0 text-accent"
          />
        </button>
      </div>

      <div class="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
        <div class="min-w-0 text-xs text-muted">
          Выбран:
          <span class="text-surface">{{ selectedUser.name }}</span>
          <span class="mx-1">·</span>
          <span>{{ roleTitle(selectedUser.role) }}</span>
        </div>
        <button
          class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80"
          @click="submitLogin"
        >
          Войти
        </button>
      </div>
    </div>
  </div>
</template>
