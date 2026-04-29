<script setup lang="ts">
import { computed, ref } from 'vue'

import ProviderSelectField from '@/components/chat/ProviderSelectField.vue'
import { useInputUI } from '@/components/ui/input'
import { useAIChat } from '@/composables/use-chat'
import { ACP_AGENTS } from '@norka/core'
import { useI18n } from '@norka/vue'

const { providerID, providerDef, setAPIKey, customBaseURL, customModelID, markACPReady } =
  useAIChat()
const { dialogs } = useI18n()

const isACP = computed(() => providerID.value.startsWith('acp:'))
const isLMStudio = computed(() => providerID.value === 'lm-studio')
const acpAgent = computed(() => {
  if (!isACP.value) return null
  const id = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === id) ?? null
})

// ─── API key form ────────────────────────────────────────────────────────────
const keyInput = ref('')
const baseURLInput = ref(customBaseURL.value)
const customModelInput = ref(customModelID.value)

function save() {
  const key = keyInput.value.trim()
  if (!key) return
  if (providerDef.value.supportsCustomBaseURL) {
    customBaseURL.value = baseURLInput.value.trim()
  }
  if (providerDef.value.supportsCustomModel) {
    customModelID.value = customModelInput.value.trim()
  }
  setAPIKey(key)
  keyInput.value = ''
}

// ─── LM Studio ───────────────────────────────────────────────────────────────
const lmModelInput = ref(customModelID.value)
const detectedModels = ref<string[]>([])
const lmStatus = ref<'idle' | 'detecting' | 'found' | 'not-found'>('idle')

async function detectLMStudioModels() {
  lmStatus.value = 'detecting'
  detectedModels.value = []
  try {
    const res = await fetch('http://localhost:1234/v1/models')
    if (!res.ok) throw new Error('not ok')
    const data = await res.json()
    const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
    detectedModels.value = ids
    if (ids.length > 0 && !lmModelInput.value) lmModelInput.value = ids[0]
    lmStatus.value = 'found'
  } catch {
    lmStatus.value = 'not-found'
  }
}

function saveLMStudio() {
  const model = lmModelInput.value.trim()
  if (!model) return
  customModelID.value = model
}

// ─── ACP setup (norka-mcp + claude-agent-acp both bundled as sidecars) ─────
const isRunning = ref(false)
const setupError = ref<string | null>(null)
const connectSuccess = ref(false)

async function runSetup() {
  isRunning.value = true
  setupError.value = null
  connectSuccess.value = false

  try {
    // norka-mcp and claude-agent-acp are bundled inside the .app as sidecars.
    // Just start the MCP server — no npm install needed.
    const { spawnMCPIfNeeded } = await import('@/automation/spawn-mcp')
    await spawnMCPIfNeeded()
    markACPReady(providerID.value)
    connectSuccess.value = true
  } catch (e) {
    setupError.value = e instanceof Error ? e.message : String(e)
  } finally {
    isRunning.value = false
  }
}
</script>

<template>
  <div data-test-id="provider-setup" class="flex flex-1 flex-col items-center justify-center px-6">
    <icon-lucide-sparkles class="mb-3 size-7 text-muted" />
    <p class="mb-5 text-center text-xs text-muted">{{ dialogs.connectAIProvider }}</p>

    <!-- LM Studio — no API key needed -->
    <div v-if="isLMStudio" class="flex w-full flex-col gap-2">
      <ProviderSelectField test-id="provider-selector" />

      <div class="flex gap-2">
        <input
          v-model="lmModelInput"
          type="text"
          data-test-id="lm-model-input"
          :placeholder="dialogs.modelIDPlaceholder"
          :class="[useInputUI().base, 'flex-1']"
          :list="detectedModels.length ? 'lm-models-list' : undefined"
        />
        <datalist v-if="detectedModels.length" id="lm-models-list">
          <option v-for="m in detectedModels" :key="m" :value="m" />
        </datalist>
        <button
          type="button"
          data-test-id="lm-detect-btn"
          class="shrink-0 rounded bg-input px-2.5 text-xs text-surface hover:bg-input/80"
          :disabled="lmStatus === 'detecting'"
          @click="detectLMStudioModels"
        >
          {{ lmStatus === 'detecting' ? '…' : dialogs.detectModels }}
        </button>
      </div>

      <p class="text-[10px] text-muted">
        <template v-if="lmStatus === 'found'">
          <span class="text-green-500">LM Studio запущен ✓</span>
          <span v-if="detectedModels.length">
            — {{ detectedModels.length }} {{ dialogs.modelsLoaded }}</span
          >
        </template>
        <template v-else-if="lmStatus === 'not-found'">
          <span class="text-amber-500">{{ dialogs.lmStudioNotFound }}</span>
        </template>
        <template v-else>
          {{ dialogs.lmStudioHint }}
        </template>
      </p>

      <button
        type="button"
        data-test-id="lm-save-btn"
        class="mt-1 w-full rounded bg-accent py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-40"
        :disabled="!lmModelInput.trim()"
        @click="saveLMStudio"
      >
        {{ dialogs.connect }}
      </button>
    </div>

    <!-- Regular API key form -->
    <form v-else-if="!isACP" class="flex w-full flex-col gap-2" @submit.prevent="save">
      <ProviderSelectField test-id="provider-selector" />

      <input
        v-if="providerDef.supportsCustomBaseURL"
        v-model="baseURLInput"
        type="text"
        data-test-id="provider-base-url"
        :placeholder="dialogs.baseURLPlaceholder"
        :class="useInputUI().base"
      />

      <input
        v-if="providerDef.supportsCustomModel"
        v-model="customModelInput"
        type="text"
        data-test-id="provider-custom-model"
        :placeholder="dialogs.modelIDPlaceholder"
        :class="useInputUI().base"
      />

      <input
        v-model="keyInput"
        type="password"
        data-test-id="api-key-input"
        :placeholder="providerDef.keyPlaceholder"
        :class="useInputUI().base"
      />

      <button
        type="submit"
        data-test-id="api-key-save"
        class="mt-1 w-full rounded bg-accent py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        :disabled="!keyInput.trim()"
      >
        {{ dialogs.connect }}
      </button>
    </form>

    <!-- ACP agent setup (all binaries bundled as sidecars in the .app) -->
    <div v-else class="flex w-full flex-col gap-2">
      <ProviderSelectField test-id="provider-selector" />

      <p class="text-center text-[10px] leading-relaxed text-muted">
        Использует вашу подписку {{ acpAgent?.name }}.<br />
        Убедитесь, что Claude Code установлен и авторизован в системе.
      </p>

      <!-- Error message -->
      <p v-if="setupError" class="whitespace-pre-wrap text-[10px] leading-relaxed text-red-400">
        {{ setupError }}
      </p>

      <!-- Success -->
      <p v-if="connectSuccess" class="text-center text-[10px] text-green-400">
        Подключено ✓ Можете начинать чат.
      </p>

      <!-- Connect button -->
      <button
        type="button"
        data-test-id="acp-connect-btn"
        class="mt-1 w-full rounded bg-accent py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-40"
        :disabled="isRunning || connectSuccess"
        @click="runSetup"
      >
        <span v-if="isRunning" class="flex items-center justify-center gap-1.5">
          <icon-lucide-loader-2 class="size-3 animate-spin" />
          Подключение…
        </span>
        <span v-else-if="connectSuccess">Подключено ✓</span>
        <span v-else>Подключить</span>
      </button>
    </div>

    <a
      v-if="!isACP && !isLMStudio && providerDef.keyURL"
      :href="providerDef.keyURL"
      target="_blank"
      data-test-id="api-key-get-link"
      class="mt-2.5 text-[10px] text-muted underline hover:text-surface"
    >
      {{ dialogs.getAPIKey({ provider: providerDef.name }) }}
    </a>

    <p
      v-if="providerID === 'openrouter'"
      class="mt-3 text-center text-[10px] leading-relaxed text-muted/50"
    >
      {{ dialogs.oneKeyManyModels }}
    </p>
  </div>
</template>
