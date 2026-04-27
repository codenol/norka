<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { computed, markRaw, nextTick, ref, watch } from 'vue'

import { didHitStepLimit } from '@/ai/tools'
import { injectProtoStore } from '@/composables/use-proto-store'
import { activeTab } from '@/stores/tabs'
import ACPPermissionDialog from '@/components/chat/ACPPermissionDialog.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import { useAIChat } from '@/composables/use-chat'
import { toast } from '@/utils/toast'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'

type CanvasTarget = 'editor' | 'proto'
const props = defineProps<{ canvasTarget?: CanvasTarget }>()
const injectedProtoStore = injectProtoStore()
const effectiveTarget = computed<CanvasTarget>(() => {
  if (props.canvasTarget) return props.canvasTarget
  return injectedProtoStore ? 'proto' : 'editor'
})
const protoStore = computed(() => (effectiveTarget.value === 'proto' ? injectedProtoStore ?? undefined : undefined))

const { isConfigured, ensureChat, chatSessions, providerID } = useAIChat()

// ── Sessions ──────────────────────────────────────────────────────────────────
const { sessions, activeSessionId, createSession, renameSession, deleteSession, setActiveSession } =
  chatSessions

const renamingId = ref<string | null>(null)
const renameValue = ref('')

function startRename(id: string, currentName: string) {
  renamingId.value = id
  renameValue.value = currentName
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(`[data-session-rename="${id}"]`)
    el?.focus()
    el?.select()
  })
}

function commitRename(id: string) {
  if (renameValue.value.trim()) renameSession(id, renameValue.value.trim())
  renamingId.value = null
}

function handleDeleteSession(id: string) {
  const session = sessions.value.find((s) => s.id === id)
  if (session && session.messages.length > 0) {
    if (!confirm(`Удалить «${session.name}»?`)) return
  }
  deleteSession(id)
}

function handleNewSession() {
  createSession(providerID.value)
}

const chat = ref<Chat<UIMessage> | null>(null)

ensureChat(effectiveTarget.value, { protoStore: protoStore.value }).then((c) => {
  if (c) chat.value = markRaw(c)
})
const messagesEnd = ref<HTMLDivElement>()

const messages = computed(() => chat.value?.messages ?? [])
const status = computed(() => chat.value?.status ?? 'ready')
const isThinking = computed(() => {
  const s = status.value
  if (s !== 'submitted' && s !== 'streaming') return false
  if (messages.value.length === 0) return true
  const last = messages.value[messages.value.length - 1]
  if (last.role !== 'assistant') return true
  const parts = last.parts
  if (parts.length === 0) return true
  const lastPart = parts[parts.length - 1] as Record<string, unknown>
  if (lastPart.type === 'step-start') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-available') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-error') return true
  return s === 'submitted'
})

const showContinue = computed(() => {
  if (status.value !== 'ready') return false
  if (messages.value.length === 0) return false
  const last = messages.value[messages.value.length - 1]
  return last.role === 'assistant' && didHitStepLimit()
})

function scrollToBottom() {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

watch(messages, scrollToBottom, { deep: true })
watch(
  () => activeTab.value?.id,
  async () => {
    const nextChat = await ensureChat(effectiveTarget.value, { protoStore: protoStore.value })
    chat.value = nextChat ? markRaw(nextChat) : null
  }
)

watch(activeSessionId, async () => {
  const nextChat = await ensureChat(effectiveTarget.value, { protoStore: protoStore.value })
  chat.value = nextChat ? markRaw(nextChat) : null
})

async function handleSubmit(text: string) {
  if (status.value === 'streaming' || status.value === 'submitted') return
  try {
    const c = await ensureChat(effectiveTarget.value, { protoStore: protoStore.value })
    if (c) chat.value = markRaw(c)
  } catch (e) {
    console.error('Failed to initialize chat:', e)
    toast.error(e instanceof Error ? e.message : String(e))
    return
  }
  chat.value?.sendMessage({ text }).catch((e: unknown) => {
    console.error('Chat error:', e)
    toast.error(e instanceof Error ? e.message : String(e))
  })
}

function handleStop() {
  chat.value?.stop()
}
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <!-- Session tabs — всегда видны -->
    <div
      class="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 py-1 scrollbar-none"
      data-test-id="session-tabs"
    >
      <button
        class="flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-hover hover:text-surface"
        title="Новая сессия"
        @click="handleNewSession"
      >
        <icon-lucide-plus class="size-3" />
      </button>
      <div
        v-for="s in sessions"
        :key="s.id"
        class="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]"
        :class="s.id === activeSessionId ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-hover hover:text-surface'"
        :data-test-id="`session-tab-${s.id}`"
      >
        <input
          v-if="renamingId === s.id"
          :data-session-rename="s.id"
          v-model="renameValue"
          class="w-20 bg-transparent outline-none"
          @blur="commitRename(s.id)"
          @keydown.enter.prevent="commitRename(s.id)"
          @keydown.escape.prevent="renamingId = null"
          @click.stop
        />
        <span
          v-else
          class="cursor-pointer"
          @click="setActiveSession(s.id)"
          @dblclick="startRename(s.id, s.name)"
          >{{ s.name }}</span
        >
        <button
          class="ml-0.5 rounded p-px opacity-50 hover:opacity-100"
          @click.stop="handleDeleteSession(s.id)"
        >
          <icon-lucide-x class="size-2.5" />
        </button>
      </div>
    </div>

    <!-- Provider setup -->
    <ProviderSetup v-if="!isConfigured" />

    <template v-else>
      <ScrollAreaRoot class="min-h-0 flex-1">
        <ScrollAreaViewport class="h-full px-3 py-3 [&>div]:h-full">
          <!-- Empty state -->
          <div
            v-if="messages.length === 0"
            data-test-id="chat-empty-state"
            class="flex h-full flex-col items-center justify-center gap-3 text-muted"
          >
            <icon-lucide-message-circle class="size-8 opacity-50" />
            <p class="text-center text-xs">Опишите, что нужно создать или изменить на канвасе</p>
          </div>

          <!-- Messages -->
          <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
            <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />

            <!-- Thinking indicator: shown when AI is working but no visible activity -->
            <div v-if="isThinking" data-test-id="chat-typing-indicator" class="flex gap-2">
              <div
                class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-[10px] font-bold text-muted"
              >
                AI
              </div>
              <div class="flex items-center gap-1 py-2">
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 0ms"
                />
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 150ms"
                />
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 300ms"
                />
              </div>
            </div>

            <!-- Continue button when step limit reached -->
            <div v-if="showContinue" class="flex justify-center py-2">
              <button
                class="flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                @click="handleSubmit('Continue where you left off')"
              >
                <icon-lucide-play class="size-3" />
                Continue
              </button>
            </div>

            <div ref="messagesEnd" />
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
          <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>

      <ChatInput :status="status" @submit="handleSubmit" @stop="handleStop" />

      <ACPPermissionDialog />
    </template>
  </div>
</template>
