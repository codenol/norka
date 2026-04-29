<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'

import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import ProviderSelectField from '@/components/chat/ProviderSelectField.vue'
import { useDialogUI } from '@/components/ui/dialog'
import { useInputUI } from '@/components/ui/input'
import { useAIChat } from '@/composables/use-chat'
import { useSettingsDialog } from '@/composables/use-settings-dialog'

const { open } = useSettingsDialog()
const cls = useDialogUI({ content: 'flex w-[480px] max-w-[95vw] flex-col' })

const {
  providerID,
  providerDef,
  apiKey,
  setAPIKey,
  customBaseURL,
  customModelID,
  customAPIType,
  maxOutputTokens,
  pexelsApiKey,
  unsplashAccessKey,
  isConfigured
} = useAIChat()

const isACP = computed(() => providerID.value.startsWith('acp:'))

const keyInput = ref('')
const pexelsKeyInput = ref('')
const unsplashKeyInput = ref('')
const baseURLInput = ref(customBaseURL.value)
const customModelInput = ref(customModelID.value)
const hasExistingKey = ref(!!apiKey.value)
const hasExistingPexelsKey = ref(!!pexelsApiKey.value)
const hasExistingUnsplashKey = ref(!!unsplashAccessKey.value)

watch(providerID, () => {
  keyInput.value = ''
  hasExistingKey.value = !!apiKey.value
  baseURLInput.value = customBaseURL.value
  customModelInput.value = customModelID.value
})

watch(apiKey, (v) => {
  hasExistingKey.value = !!v
})

function save() {
  if (keyInput.value.trim()) {
    setAPIKey(keyInput.value.trim())
    keyInput.value = ''
  }
  if (pexelsKeyInput.value.trim()) {
    pexelsApiKey.value = pexelsKeyInput.value.trim()
    pexelsKeyInput.value = ''
  }
  if (unsplashKeyInput.value.trim()) {
    unsplashAccessKey.value = unsplashKeyInput.value.trim()
    unsplashKeyInput.value = ''
  }
  if (providerDef.value.supportsCustomBaseURL) {
    customBaseURL.value = baseURLInput.value.trim()
  }
  if (providerDef.value.supportsCustomModel) {
    customModelID.value = customModelInput.value.trim()
  }
}

function clearKey() {
  setAPIKey('')
  keyInput.value = ''
  hasExistingKey.value = false
}

function clearPexelsKey() {
  pexelsApiKey.value = ''
  pexelsKeyInput.value = ''
  hasExistingPexelsKey.value = false
}

function clearUnsplashKey() {
  unsplashAccessKey.value = ''
  unsplashKeyInput.value = ''
  hasExistingUnsplashKey.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :class="cls.content">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <DialogTitle :class="cls.title">Настройки AI</DialogTitle>
          <DialogClose class="rounded p-1 text-muted hover:bg-hover hover:text-surface">
            <icon-lucide-x class="size-4" />
          </DialogClose>
        </div>

        <!-- Setup flow (not configured) -->
        <div v-if="!isConfigured" class="p-4">
          <ProviderSetup />
        </div>

        <!-- Settings (configured) -->
        <div v-else class="flex flex-col gap-3 p-4">
          <ProviderSelectField />

          <!-- Max output tokens -->
          <div v-if="!isACP" class="flex flex-col gap-1">
            <label class="text-[11px] text-muted">Макс. токенов ответа</label>
            <input
              v-model.number="maxOutputTokens"
              type="number"
              :min="1024"
              :max="128000"
              :step="1024"
              :class="useInputUI({ size: 'sm' }).base"
            />
          </div>

          <template v-if="!isACP">
            <!-- Base URL -->
            <div v-if="providerDef.supportsCustomBaseURL" class="flex flex-col gap-1">
              <label class="text-[11px] text-muted">Base URL</label>
              <input
                v-model="baseURLInput"
                type="text"
                placeholder="http://localhost:11434/v1"
                :class="useInputUI({ size: 'sm' }).base"
                @change="save"
              />
            </div>

            <!-- Custom model -->
            <div v-if="providerDef.supportsCustomModel" class="flex flex-col gap-1">
              <label class="text-[11px] text-muted">Model ID</label>
              <input
                v-model="customModelInput"
                type="text"
                placeholder="e.g. llama-3.3-70b"
                :class="useInputUI({ size: 'sm' }).base"
                @change="save"
              />
            </div>

            <!-- API type -->
            <div v-if="providerID === 'openai-compatible'" class="flex flex-col gap-1">
              <label class="text-[11px] text-muted">API Type</label>
              <TabsRoot
                :model-value="customAPIType"
                class="flex flex-col"
                @update:model-value="
                  (v: string) => {
                    customAPIType = v as 'completions' | 'responses'
                    save()
                  }
                "
              >
                <TabsList class="flex rounded bg-canvas">
                  <TabsTrigger
                    value="completions"
                    class="flex-1 rounded px-2 py-1 text-[11px] text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
                  >
                    Completions
                  </TabsTrigger>
                  <TabsTrigger
                    value="responses"
                    class="flex-1 rounded px-2 py-1 text-[11px] text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
                  >
                    Responses
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="completions" />
                <TabsContent value="responses" />
              </TabsRoot>
            </div>

            <!-- API key -->
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] text-muted">API Key</label>
                <button
                  v-if="apiKey"
                  class="cursor-pointer text-[10px] text-muted hover:text-surface"
                  @click="clearKey"
                >
                  Удалить
                </button>
              </div>
              <input
                v-model="keyInput"
                type="password"
                :placeholder="
                  hasExistingKey
                    ? 'Ключ сохранён — введите новый для замены'
                    : providerDef.keyPlaceholder
                "
                :class="useInputUI({ size: 'sm' }).base"
                @change="save"
              />
              <a
                v-if="providerDef.keyURL"
                :href="providerDef.keyURL"
                target="_blank"
                class="text-[10px] text-muted underline hover:text-surface"
              >
                Получить API ключ →
              </a>
            </div>
          </template>

          <!-- Stock photos (optional) -->
          <details class="group">
            <summary class="cursor-pointer text-[11px] text-muted hover:text-surface">
              Фото-сток (опционально)
            </summary>
            <div class="mt-2 flex flex-col gap-2">
              <!-- Pexels -->
              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between">
                  <label class="text-[10px] text-muted">Pexels API Key</label>
                  <button
                    v-if="pexelsApiKey"
                    class="cursor-pointer text-[10px] text-muted hover:text-surface"
                    @click="clearPexelsKey"
                  >
                    Удалить
                  </button>
                </div>
                <input
                  v-model="pexelsKeyInput"
                  type="password"
                  :placeholder="hasExistingPexelsKey ? 'Ключ сохранён' : 'Опционально'"
                  :class="useInputUI({ size: 'sm' }).base"
                  @change="save"
                />
              </div>
              <!-- Unsplash -->
              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between">
                  <label class="text-[10px] text-muted">Unsplash Access Key</label>
                  <button
                    v-if="unsplashAccessKey"
                    class="cursor-pointer text-[10px] text-muted hover:text-surface"
                    @click="clearUnsplashKey"
                  >
                    Удалить
                  </button>
                </div>
                <input
                  v-model="unsplashKeyInput"
                  type="password"
                  :placeholder="hasExistingUnsplashKey ? 'Ключ сохранён' : 'Опционально'"
                  :class="useInputUI({ size: 'sm' }).base"
                  @change="save"
                />
              </div>
            </div>
          </details>

          <!-- Footer -->
          <div class="mt-1 border-t border-border pt-3">
            <button
              class="w-full rounded bg-accent px-3 py-1.5 text-center text-[12px] font-medium text-white hover:bg-accent/90"
              @click="save(); open = false"
            >
              Сохранить
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
