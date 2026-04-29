<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed, ref } from 'vue'

import ProviderModelSelect from '@/components/chat/ProviderModelSelect.vue'
import ProviderSettings from '@/components/chat/ProviderSettings.vue'
import Tip from '@/components/ui/Tip.vue'
import { useButtonUI } from '@/components/ui/button'
import { useInputUI } from '@/components/ui/input'
import { useAIChat } from '@/composables/use-chat'
import { useI18n } from '@norka/vue'

import { ACP_AGENTS } from '@norka/core'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { dialogs } = useI18n()

const props = withDefaults(
  defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  isThinking?: boolean
  }>(),
  {
    isThinking: false
  }
)

const emit = defineEmits<{
  submit: [text: string]
  stop: []
}>()

const input = ref('')

const isStreaming = computed(
  () =>
    props.isThinking || props.status === 'streaming' || props.status === 'submitted'
)
const isACPProvider = computed(() => providerID.value.startsWith('acp:'))
const acpAgentName = computed(() => {
  const agentId = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === agentId)?.name ?? agentId
})
const isCustomProvider = computed(
  () =>
    providerID.value === 'openai-compatible' ||
    providerID.value === 'anthropic-compatible' ||
    providerID.value === 'lm-studio'
)

const selectedModelName = computed(() => {
  if (isCustomProvider.value) return customModelID.value || 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  emit('submit', text)
  input.value = ''
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border px-3 py-2">
      <!-- Model selector & settings -->
      <div class="mb-1.5 flex items-center gap-1">
        <template v-if="isACPProvider">
          <div class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted">
            <icon-lucide-bot class="size-3" />
            {{ acpAgentName }}
          </div>
        </template>
        <template v-else-if="isCustomProvider">
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted"
            data-test-id="chat-custom-model-label"
          >
            <icon-lucide-bot class="size-3" />
            {{ selectedModelName }}
          </div>
        </template>
        <ProviderModelSelect v-else>
          <template #value>{{ selectedModelName }}</template>
        </ProviderModelSelect>

        <div class="ml-auto">
          <ProviderSettings />
        </div>
      </div>

      <!-- Input form -->
      <form class="flex gap-1.5" @submit="handleSubmit">
        <input
          v-model="input"
          type="text"
          data-test-id="chat-input"
          :placeholder="dialogs.describeChange"
          :class="useInputUI({ ui: { base: 'min-w-0 flex-1 placeholder:text-muted' } }).base"
          :disabled="isStreaming"
          @paste.stop
          @copy.stop
          @cut.stop
        />
        <Tip :label="isStreaming ? dialogs.stopGenerating : dialogs.sendMessage">
          <button
            :type="isStreaming ? 'button' : 'submit'"
            data-test-id="chat-send-button"
            :class="
              useButtonUI({
                tone: 'accent',
                shape: 'rounded',
                size: 'sm',
                ui: {
                  base: isStreaming
                    ? 'shrink-0 gap-1.5 border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-danger hover:bg-danger/15'
                    : 'shrink-0 px-2.5 py-1.5 font-medium'
                }
              }).base
            "
            :disabled="isStreaming ? false : !input.trim()"
            @click="isStreaming ? emit('stop') : undefined"
          >
            <icon-lucide-square v-if="isStreaming" class="size-3" />
            <span v-if="isStreaming" class="text-xs font-medium">Стоп</span>
            <icon-lucide-send v-else class="size-3" />
          </button>
        </Tip>
      </form>
    </div>
  </TooltipProvider>
</template>
